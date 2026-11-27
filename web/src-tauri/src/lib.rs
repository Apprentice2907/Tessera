// Tessera · the desktop app's own side.
//
// It does what serve.py did, without Python: your data is one file per key in the app's folder (store/), the same keys
// and format the web app saves (`tessera.state`, `tessera.walls`, `tessera.wb.*`); a copy of everything is made before the
// first change of each day (backups/, the last 60 kept); and it fetches upcoming contests from Codeforces, CodeChef and
// LeetCode, kept for half an hour. The app's pages reach all of this through the commands below (src/store/backend.ts).
//
// It also runs the two windows: the app, and the to-do widget that sits on the desktop behind your other windows.
// A tray icon opens the app, shows or hides the widget, turns "Start with Windows" on or off, and quits.
// Closing the app's window while the widget is on keeps Tessera running for the widget; otherwise it quits.
// TESSERA_DATA=<folder> runs it on another data folder, TESSERA_PAGE=<page> opens it on a page (both for testing).
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

const KEEP: usize = 60; // backups kept
const CONTESTS_FOR: Duration = Duration::from_secs(30 * 60);

fn key_ok(key: &str) -> bool {
    static RE: OnceLock<regex::Regex> = OnceLock::new();
    RE.get_or_init(|| regex::Regex::new(r"^tessera\.[a-z0-9._-]{1,80}$").unwrap()).is_match(key)
}

// ---------- the store: one file per key ----------
struct Store {
    data: PathBuf,
    lock: Mutex<()>,
    contests: Mutex<Option<(Instant, Vec<Contest>)>>,
}

impl Store {
    fn dir(&self) -> PathBuf { self.data.join("store") }
    fn backups_dir(&self) -> PathBuf { self.data.join("backups") }
    fn file(&self, key: &str) -> PathBuf { self.dir().join(format!("{key}.json")) }
    fn read(&self, key: &str) -> Option<String> { fs::read_to_string(self.file(key)).ok() }

    fn read_all(&self, prefix: &str) -> HashMap<String, String> {
        let mut out = HashMap::new();
        if let Ok(entries) = fs::read_dir(self.dir()) {
            for e in entries.flatten() {
                let name = e.file_name().to_string_lossy().to_string();
                if let Some(key) = name.strip_suffix(".json") {
                    if key.starts_with(prefix) && key_ok(key) {
                        if let Some(v) = self.read(key) { out.insert(key.to_string(), v); }
                    }
                }
            }
        }
        out
    }

    /// written to a temporary file and swapped in, so a crash never leaves half a file; None deletes the key
    fn write(&self, key: &str, value: Option<&str>) -> std::io::Result<()> {
        fs::create_dir_all(self.dir())?;
        self.daily_backup();
        let path = self.file(key);
        match value {
            None => { if path.exists() { fs::remove_file(&path)?; } }
            Some(v) => {
                let tmp = path.with_extension("json.tmp");
                fs::write(&tmp, v)?;
                fs::rename(&tmp, &path)?;
            }
        }
        Ok(())
    }

    // ---------- backups: a folder per copy, named by when it was made ----------
    fn backups(&self) -> Vec<BackupInfo> {
        let mut names: Vec<String> = fs::read_dir(self.backups_dir()).map(|r| r.flatten()
            .filter(|e| e.path().is_dir()).map(|e| e.file_name().to_string_lossy().to_string()).collect()).unwrap_or_default();
        names.sort();
        names.reverse();
        names.into_iter().map(|name| {
            let (mut keys, mut bytes) = (0, 0);
            if let Ok(files) = fs::read_dir(self.backups_dir().join(&name)) {
                for f in files.flatten() {
                    if f.file_name().to_string_lossy().ends_with(".json") { keys += 1; bytes += f.metadata().map(|m| m.len()).unwrap_or(0); }
                }
            }
            BackupInfo { name, keys, bytes }
        }).collect()
    }

    /// copies every key into backups/<name>, then drops the oldest copies past KEEP
    fn backup(&self, name: &str) -> Option<String> {
        let files: Vec<PathBuf> = fs::read_dir(self.dir()).ok()?.flatten().map(|e| e.path())
            .filter(|p| p.extension().map_or(false, |x| x == "json")).collect();
        if files.is_empty() { return None; }
        let dest = self.backups_dir().join(name);
        if dest.exists() { return Some(name.to_string()); }
        fs::create_dir_all(&dest).ok()?;
        for f in &files { let _ = fs::copy(f, dest.join(f.file_name()?)); }
        let mut all: Vec<PathBuf> = fs::read_dir(self.backups_dir()).ok()?.flatten().map(|e| e.path()).filter(|p| p.is_dir()).collect();
        all.sort();
        if all.len() > KEEP { for old in &all[..all.len() - KEEP] { let _ = fs::remove_dir_all(old); } }
        Some(name.to_string())
    }

    /// before the first change of a day, keep a copy of how everything stood
    fn daily_backup(&self) {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let done = fs::read_dir(self.backups_dir()).map(|r| r.flatten().any(|e| e.file_name().to_string_lossy().starts_with(&today))).unwrap_or(false);
        if !done { self.backup(&today); }
    }
}

#[derive(Serialize)]
struct BackupInfo { name: String, keys: usize, bytes: u64 }
#[derive(Serialize)]
struct BackupList { backups: Vec<BackupInfo>, keep: usize, folder: String }

#[tauri::command]
fn state_get(store: tauri::State<Store>, key: String) -> Result<Option<String>, String> {
    if !key_ok(&key) { return Err("unknown key".into()); }
    let _g = store.lock.lock().unwrap();
    Ok(store.read(&key))
}

#[tauri::command]
fn state_all(store: tauri::State<Store>, prefix: String) -> HashMap<String, String> {
    let _g = store.lock.lock().unwrap();
    store.read_all(&prefix)
}

#[tauri::command]
fn state_set(store: tauri::State<Store>, key: String, value: Option<String>) -> Result<(), String> {
    if !key_ok(&key) { return Err("bad request".into()); }
    let _g = store.lock.lock().unwrap();
    store.write(&key, value.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn backups_list(store: tauri::State<Store>) -> BackupList {
    let _g = store.lock.lock().unwrap();
    BackupList { backups: store.backups(), keep: KEEP, folder: store.backups_dir().to_string_lossy().to_string() }
}

#[tauri::command]
fn backup_now(store: tauri::State<Store>, label: Option<String>) -> Option<String> {
    let label: String = label.unwrap_or_default().to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').take(24).collect();
    let name = chrono::Local::now().format("%Y-%m-%d %H%M%S").to_string() + &if label.is_empty() { String::new() } else { format!(" {label}") };
    let _g = store.lock.lock().unwrap();
    store.backup(&name)
}

// ---------- upcoming contests, from the sites' public lists ----------
#[derive(Serialize, Clone)]
struct Contest { plat: String, title: String, start: i64, end: i64, url: String }

async fn json(client: &reqwest::Client, url: &str, body: Option<serde_json::Value>) -> Option<serde_json::Value> {
    let req = match body {
        Some(b) => client.post(url).header("Referer", "https://leetcode.com/contest/").json(&b),
        None => client.get(url),
    };
    req.send().await.ok()?.error_for_status().ok()?.json().await.ok()
}

async fn codeforces(c: &reqwest::Client) -> Option<Vec<Contest>> {
    let v = json(c, "https://codeforces.com/api/contest.list?gym=false", None).await?;
    Some(v["result"].as_array()?.iter().filter(|x| x["phase"] == "BEFORE").filter_map(|x| {
        let s = x["startTimeSeconds"].as_i64()?;
        Some(Contest { plat: "CF".into(), title: x["name"].as_str()?.into(), start: s * 1000, end: (s + x["durationSeconds"].as_i64()?) * 1000,
            url: format!("https://codeforces.com/contestRegistration/{}", x["id"].as_i64()?) })
    }).collect())
}

async fn codechef(c: &reqwest::Client) -> Option<Vec<Contest>> {
    let v = json(c, "https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all", None).await?;
    let ms = |s: &serde_json::Value| chrono::DateTime::parse_from_rfc3339(s.as_str()?).ok().map(|d| d.timestamp_millis());
    Some(v["future_contests"].as_array()?.iter().filter_map(|x| Some(Contest {
        plat: "CC".into(), title: x["contest_name"].as_str()?.into(), start: ms(&x["contest_start_date_iso"])?, end: ms(&x["contest_end_date_iso"])?,
        url: format!("https://www.codechef.com/{}", x["contest_code"].as_str()?),
    })).collect())
}

async fn leetcode(c: &reqwest::Client) -> Option<Vec<Contest>> {
    let q = serde_json::json!({ "query": "{ upcomingContests { title titleSlug startTime duration } }" });
    let v = json(c, "https://leetcode.com/graphql", Some(q)).await?;
    Some(v["data"]["upcomingContests"].as_array()?.iter().filter_map(|x| {
        let s = x["startTime"].as_i64()?;
        Some(Contest { plat: "LC".into(), title: x["title"].as_str()?.into(), start: s * 1000, end: (s + x["duration"].as_i64()?) * 1000,
            url: format!("https://leetcode.com/contest/{}", x["titleSlug"].as_str()?) })
    }).collect())
}

#[tauri::command]
async fn contests(store: tauri::State<'_, Store>) -> Result<Vec<Contest>, String> {
    if let Some((at, list)) = &*store.contests.lock().unwrap() {
        if at.elapsed() < CONTESTS_FOR { return Ok(list.clone()); }
    }
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Tessera/1.0")
        .timeout(Duration::from_secs(8)).build().map_err(|e| e.to_string())?;
    // a site that's down or changed is skipped; the others still show
    let mut list = Vec::new();
    for got in [codeforces(&client).await, codechef(&client).await, leetcode(&client).await] { list.extend(got.unwrap_or_default()); }
    list.sort_by_key(|c| c.start);
    if !list.is_empty() { *store.contests.lock().unwrap() = Some((Instant::now(), list.clone())); }
    Ok(list)
}

// ---------- the windows ----------
#[derive(Serialize, Deserialize, Default)]
struct Settings { widget: bool, set_up: bool, placed: bool }
fn settings_path(app: &AppHandle) -> PathBuf { app.state::<Store>().data.join("settings.json") }
fn load_settings(app: &AppHandle) -> Settings { fs::read_to_string(settings_path(app)).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default() }
fn save_settings(app: &AppHandle, s: &Settings) { let _ = fs::write(settings_path(app), serde_json::to_string_pretty(s).unwrap_or_default()); }

/// the app's window, in front, on a page if one is named ("today")
#[tauri::command]
fn open_main(app: AppHandle, page: Option<String>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        if let Some(p) = page.filter(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_lowercase() || c == '/')) {
            let _ = w.eval(&format!("location.hash = '#/{p}'"));
        }
    }
}

/// shows or hides the desktop widget, and remembers which
#[tauri::command]
fn set_widget(app: AppHandle, on: bool) {
    let Some(w) = app.get_webview_window("widget") else { return };
    let mut s = load_settings(&app);
    if on {
        if !s.placed { place_widget(&w); s.placed = true; }
        let _ = w.show();
    } else {
        let _ = w.hide();
    }
    s.widget = on;
    save_settings(&app, &s);
    #[cfg(desktop)]
    if let Some(t) = app.try_state::<TrayItems>() { let _ = t.widget.set_checked(on); }
}

/// the first time: bottom left of the desktop, clear of the taskbar
fn place_widget(w: &tauri::WebviewWindow) {
    if let (Ok(Some(m)), Ok(size)) = (w.current_monitor(), w.outer_size()) {
        let area = m.work_area();
        let k = m.scale_factor();
        let x = area.position.x + (28.0 * k) as i32;
        let y = area.position.y + area.size.height as i32 - size.height as i32 - (34.0 * k) as i32;
        let _ = w.set_position(tauri::PhysicalPosition::new(x, y));
    }
}

#[cfg(desktop)]
struct TrayItems { widget: tauri::menu::CheckMenuItem<tauri::Wry> }

#[cfg(desktop)]
fn tray(app: &AppHandle, widget_on: bool) -> tauri::Result<()> {
    use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    use tauri_plugin_autostart::ManagerExt;
    let open = MenuItem::with_id(app, "open", "Open Tessera", true, None::<&str>)?;
    let widget = CheckMenuItem::with_id(app, "widget", "Desktop widget", true, widget_on, None::<&str>)?;
    let auto = CheckMenuItem::with_id(app, "autostart", "Start with Windows", true, app.autolaunch().is_enabled().unwrap_or(false), None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Tessera", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &widget, &auto, &PredefinedMenuItem::separator(app)?, &quit])?;
    app.manage(TrayItems { widget: widget.clone() });
    let auto_item = auto.clone();
    TrayIconBuilder::with_id("tessera")
        .icon(app.default_window_icon().cloned().expect("the app has an icon"))
        .tooltip("Tessera")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, e| match e.id.as_ref() {
            "open" => open_main(app.clone(), None),
            "widget" => { let on = app.state::<TrayItems>().widget.is_checked().unwrap_or(false); set_widget(app.clone(), on); }
            "autostart" => {
                let al = app.autolaunch();
                let on = auto_item.is_checked().unwrap_or(false);
                let _ = if on { al.enable() } else { al.disable() };
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|t, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e { open_main(t.app_handle().clone(), None); }
        })
        .build(app)?;
    Ok(())
}

fn data_dir(app: &AppHandle) -> PathBuf {
    std::env::var_os("TESSERA_DATA").map(PathBuf::from)
        .unwrap_or_else(|| app.path().app_data_dir().unwrap_or_else(|_| Path::new(".").join("tessera-data")))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // links to the web open in your browser
    let mut b = tauri::Builder::default().plugin(tauri_plugin_opener::init());
    #[cfg(desktop)]
    {
        // a second launch opens the window that's already running
        b = b.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| open_main(app.clone(), None)))
            .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--autostart"])))
            .plugin(tauri_plugin_window_state::Builder::default()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all() & !tauri_plugin_window_state::StateFlags::VISIBLE)
                .build());
    }
    b.setup(|app| {
            let handle = app.handle().clone();
            let data = data_dir(&handle);
            fs::create_dir_all(&data)?;
            app.manage(Store { data, lock: Mutex::new(()), contests: Mutex::new(None) });

            // the first run: the widget on, and Tessera starts with Windows (both can be turned off from the tray)
            let mut s = load_settings(&handle);
            if !s.set_up {
                s.widget = true;
                s.set_up = true;
                // (not when running on a test folder: a test never registers itself to start with Windows)
                #[cfg(desktop)]
                if std::env::var_os("TESSERA_DATA").is_none() { use tauri_plugin_autostart::ManagerExt; let _ = handle.autolaunch().enable(); }
                save_settings(&handle, &s);
            }
            #[cfg(desktop)]
            tray(&handle, s.widget)?;
            if s.widget { set_widget(handle.clone(), true); }
            // started with Windows: only the widget; opened by you: the app too
            let at_sign_in = std::env::args().any(|a| a == "--autostart");
            // (TESSERA_PAGE=ideas opens it on a page, for testing)
            if !at_sign_in || !s.widget { open_main(handle.clone(), std::env::var("TESSERA_PAGE").ok()); }
            Ok(())
        })
        .on_window_event(|w, e| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = e {
                let app = w.app_handle();
                let widget_on = app.get_webview_window("widget").and_then(|x| x.is_visible().ok()).unwrap_or(false);
                match w.label() {
                    // the widget's own close (Alt+F4): it hides, like its ×
                    "widget" => { api.prevent_close(); set_widget(app.clone(), false); }
                    // the app's window: Tessera keeps running for the widget, or quits if there's none
                    "main" if widget_on => { api.prevent_close(); let _ = w.hide(); }
                    _ => app.exit(0),
                }
            }
        })
        .invoke_handler(tauri::generate_handler![state_get, state_all, state_set, backups_list, backup_now, contests, open_main, set_widget])
        .run(tauri::generate_context!())
        .expect("Tessera couldn't start");
}
