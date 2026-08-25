// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

//! Native backend for the CoffeeShop POS.
//!
//! The whole dataset is a single JSON document stored in the platform
//! application-data directory. Writes are atomic (temp file + rename) so a
//! crash mid-save can never leave a half-written database behind.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

const DB_FILE: &str = "database.json";
const BACKUP_DIR: &str = "backups";
const MAX_BACKUPS: usize = 30;

#[derive(Serialize)]
pub struct BackupInfo {
    name: String,
    size: u64,
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no application data directory: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
    Ok(dir)
}

fn backup_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = data_dir(app)?.join(BACKUP_DIR);
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
    Ok(dir)
}

/// Reject anything that could escape the backup directory.
fn safe_backup_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty()
        || trimmed.contains('/')
        || trimmed.contains('\')
        || trimmed.contains("..")
        || !trimmed.ends_with(".json")
    {
        return Err(format!("invalid backup name: {name}"));
    }
    Ok(trimmed.to_string())
}

fn write_json_atomic(path: &Path, value: &serde_json::Value) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|e| format!("cannot serialize: {e}"))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, &bytes).map_err(|e| format!("cannot write {}: {e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| format!("cannot replace {}: {e}", path.display()))?;
    Ok(())
}

#[tauri::command]
fn app_data_dir(app: AppHandle) -> Result<String, String> {
    Ok(data_dir(&app)?.to_string_lossy().to_string())
}

/// Returns `None` on a fresh install so the frontend can seed defaults.
#[tauri::command]
fn load_database(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let path = data_dir(&app)?.join(DB_FILE);
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("cannot read database: {e}"))?;
    if raw.trim().is_empty() {
        return Ok(None);
    }
    let value =
        serde_json::from_str(&raw).map_err(|e| format!("database file is not valid JSON: {e}"))?;
    Ok(Some(value))
}

#[tauri::command]
fn save_database(app: AppHandle, database: serde_json::Value) -> Result<(), String> {
    write_json_atomic(&data_dir(&app)?.join(DB_FILE), &database)
}

#[tauri::command]
fn create_backup(
    app: AppHandle,
    database: serde_json::Value,
    filename: String,
) -> Result<String, String> {
    let name = safe_backup_name(&filename)?;
    let dir = backup_dir(&app)?;
    let path = dir.join(&name);
    write_json_atomic(&path, &database)?;
    prune_backups(&dir)?;
    Ok(path.to_string_lossy().to_string())
}

fn prune_backups(dir: &Path) -> Result<(), String> {
    let mut names: Vec<String> = fs::read_dir(dir)
        .map_err(|e| format!("cannot list backups: {e}"))?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.file_name().to_string_lossy().to_string())
        .filter(|name| name.ends_with(".json"))
        .collect();
    if names.len() <= MAX_BACKUPS {
        return Ok(());
    }
    // Names carry an ISO timestamp, so lexical order is chronological order.
    names.sort();
    for name in names.iter().take(names.len() - MAX_BACKUPS) {
        let _ = fs::remove_file(dir.join(name));
    }
    Ok(())
}

#[tauri::command]
fn list_backups(app: AppHandle) -> Result<Vec<BackupInfo>, String> {
    let dir = backup_dir(&app)?;
    let mut backups: Vec<BackupInfo> = fs::read_dir(&dir)
        .map_err(|e| format!("cannot list backups: {e}"))?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".json") {
                return None;
            }
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            Some(BackupInfo { name, size })
        })
        .collect();
    backups.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(backups)
}

#[tauri::command]
fn read_backup(app: AppHandle, name: String) -> Result<serde_json::Value, String> {
    let name = safe_backup_name(&name)?;
    let path = backup_dir(&app)?.join(name);
    let raw = fs::read_to_string(&path).map_err(|e| format!("cannot read backup: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("backup is not valid JSON: {e}"))
}

#[tauri::command]
fn delete_backup(app: AppHandle, name: String) -> Result<(), String> {
    let name = safe_backup_name(&name)?;
    fs::remove_file(backup_dir(&app)?.join(name)).map_err(|e| format!("cannot delete backup: {e}"))
}

/// SHA-256, hex encoded — same scheme the Electron build used, so exported
/// user records stay compatible.
#[tauri::command]
fn hash_password(password: String) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hex::encode(hasher.finalize())
}

#[tauri::command]
fn write_binary_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| format!("cannot write {path}: {e}"))
}

#[tauri::command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("cannot read {path}: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            app_data_dir,
            load_database,
            save_database,
            create_backup,
            list_backups,
            read_backup,
            delete_backup,
            hash_password,
            write_binary_file,
            read_binary_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running CoffeeShop");
}
