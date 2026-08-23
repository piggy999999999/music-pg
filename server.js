const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

// Создаем базу данных
const db = new sqlite3.Database('./music.db');

// Создаем таблицы
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS artists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            photo TEXT
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS albums (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            year INTEGER,
            cover TEXT,
            artist_id INTEGER,
            FOREIGN KEY (artist_id) REFERENCES artists(id)
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            duration INTEGER DEFAULT 180,
            file_path TEXT,
            album_id INTEGER,
            artist_id INTEGER,
            FOREIGN KEY (album_id) REFERENCES albums(id),
            FOREIGN KEY (artist_id) REFERENCES artists(id)
        )
    `);
});

// Тестовые данные (потом удалим)
db.serialize(() => {
    // Добавляем тестового исполнителя
    db.run(`INSERT OR IGNORE INTO artists (id, name, photo) VALUES (1, 'The Weeknd', 'https://i.scdn.co/image/ab6761610000e5eb214f3cf1cbe7139c1e26ffbb')`);
    
    // Добавляем тестовый альбом
    db.run(`INSERT OR IGNORE INTO albums (id, title, year, cover, artist_id) VALUES (1, 'After Hours', 2020, 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36', 1)`);
    
    // Добавляем тестовые треки
    db.run(`INSERT OR IGNORE INTO tracks (id, title, duration, artist_id, album_id) VALUES (1, 'Blinding Lights', 200, 1, 1)`);
    db.run(`INSERT OR IGNORE INTO tracks (id, title, duration, artist_id, album_id) VALUES (2, 'Save Your Tears', 215, 1, 1)`);
    db.run(`INSERT OR IGNORE INTO tracks (id, title, duration, artist_id, album_id) VALUES (3, 'In Your Eyes', 210, 1, 1)`);
});

// API для получения всех треков
app.get('/api/tracks', (req, res) => {
    db.all(`
        SELECT tracks.*, artists.name as artist_name, albums.title as album_title
        FROM tracks
        LEFT JOIN artists ON tracks.artist_id = artists.id
        LEFT JOIN albums ON tracks.album_id = albums.id
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// API для поиска треков
app.get('/api/tracks/search', (req, res) => {
    const query = req.query.q || '';
    db.all(`
        SELECT tracks.*, artists.name as artist_name, albums.title as album_title
        FROM tracks
        LEFT JOIN artists ON tracks.artist_id = artists.id
        LEFT JOIN albums ON tracks.album_id = albums.id
        WHERE tracks.title LIKE ?
    `, [`%${query}%`], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// API для получения информации об исполнителе
app.get('/api/artists/:id', (req, res) => {
    const artistId = req.params.id;
    
    db.get('SELECT * FROM artists WHERE id = ?', [artistId], (err, artist) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!artist) {
            res.status(404).json({ error: 'Artist not found' });
            return;
        }
        
        db.all('SELECT * FROM tracks WHERE artist_id = ?', [artistId], (err, tracks) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            db.all(`
                SELECT DISTINCT albums.* FROM albums
                JOIN tracks ON tracks.album_id = albums.id
                WHERE tracks.artist_id = ?
            `, [artistId], (err, albums) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                res.json({ artist, tracks, albums });
            });
        });
    });
});

// API для получения списка альбомов
app.get('/api/albums', (req, res) => {
    db.all(`
        SELECT albums.*, artists.name as artist_name,
        (SELECT COUNT(*) FROM tracks WHERE tracks.album_id = albums.id) as track_count
        FROM albums
        LEFT JOIN artists ON albums.artist_id = artists.id
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// API для получения информации об альбоме
app.get('/api/albums/:id', (req, res) => {
    const albumId = req.params.id;
    
    db.get(`
        SELECT albums.*, artists.name as artist_name
        FROM albums
        LEFT JOIN artists ON albums.artist_id = artists.id
        WHERE albums.id = ?
    `, [albumId], (err, album) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!album) {
            res.status(404).json({ error: 'Album not found' });
            return;
        }
        
        db.all(`
            SELECT tracks.*, artists.name as artist_name
            FROM tracks
            LEFT JOIN artists ON tracks.artist_id = artists.id
            WHERE tracks.album_id = ?
        `, [albumId], (err, tracks) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            res.json({ album, tracks });
        });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
