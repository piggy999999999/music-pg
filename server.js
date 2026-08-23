const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const mm = require('music-metadata');
const fs = require('fs');
const app = express();
const port = 3000;

// Настройка EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Статические файлы
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/covers', express.static('covers'));
app.use(express.json());

// Создаем папки, если их нет
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}
if (!fs.existsSync('covers')) {
    fs.mkdirSync('covers');
}

// Настройка загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        const allowedExtensions = ['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus'];
        const extension = path.extname(file.originalname).toLowerCase();
        
        if (file.mimetype.startsWith('audio/') || allowedExtensions.includes(extension)) {
            cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый формат файла!'), false);
        }
    }
});

// Создаем базу данных
const db = new sqlite3.Database('./music.db');

// Создаем таблицы
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS artists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
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

// Функция для получения или создания исполнителя
function getOrCreateArtist(name, photo = null) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM artists WHERE name = ?', [name], (err, artist) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (artist) {
                if (photo && !artist.photo) {
                    db.run('UPDATE artists SET photo = ? WHERE id = ?', [photo, artist.id]);
                    artist.photo = photo;
                }
                resolve(artist);
            } else {
                db.run('INSERT INTO artists (name, photo) VALUES (?, ?)', [name, photo], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ id: this.lastID, name, photo });
                });
            }
        });
    });
}

// Функция для получения или создания альбома
function getOrCreateAlbum(title, artistId, year = null, cover = null) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM albums WHERE title = ? AND artist_id = ?', [title, artistId], (err, album) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (album) {
                if (cover && !album.cover) {
                    db.run('UPDATE albums SET cover = ? WHERE id = ?', [cover, album.id]);
                    album.cover = cover;
                }
                if (year && !album.year) {
                    db.run('UPDATE albums SET year = ? WHERE id = ?', [year, album.id]);
                    album.year = year;
                }
                resolve(album);
            } else {
                db.run('INSERT INTO albums (title, year, cover, artist_id) VALUES (?, ?, ?, ?)', 
                    [title, year, cover, artistId], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ id: this.lastID, title, year, cover, artist_id: artistId });
                });
            }
        });
    });
}

// ============ МАРШРУТЫ СТРАНИЦ ============

// Главная страница
app.get('/', (req, res) => {
    db.all(`
        SELECT tracks.*, artists.name as artist_name, albums.title as album_title,
               albums.cover as album_cover
        FROM tracks
        LEFT JOIN artists ON tracks.artist_id = artists.id
        LEFT JOIN albums ON tracks.album_id = albums.id
    `, (err, tracks) => {
        if (err) {
            console.error('Ошибка загрузки треков:', err);
            tracks = [];
        }
        res.render('home', { 
            title: 'Главная',
            tracks: tracks,
            activePage: 'home'
        });
    });
});

// Страница поиска
app.get('/search', (req, res) => {
    res.render('search', { 
        title: 'Поиск',
        activePage: 'search'
    });
});

// Страница альбомов
app.get('/albums', (req, res) => {
    db.all(`
        SELECT albums.*, artists.name as artist_name,
        (SELECT COUNT(*) FROM tracks WHERE tracks.album_id = albums.id) as track_count
        FROM albums
        LEFT JOIN artists ON albums.artist_id = artists.id
    `, (err, albums) => {
        if (err) {
            console.error('Ошибка загрузки альбомов:', err);
            albums = [];
        }
        res.render('albums', { 
            title: 'Альбомы',
            albums: albums,
            activePage: 'albums'
        });
    });
});

// Страница альбома
app.get('/album/:id', (req, res) => {
    const albumId = req.params.id;
    
    db.get(`
        SELECT albums.*, artists.name as artist_name
        FROM albums
        LEFT JOIN artists ON albums.artist_id = artists.id
        WHERE albums.id = ?
    `, [albumId], (err, album) => {
        if (err || !album) {
            console.error('Альбом не найден:', err);
            res.redirect('/albums');
            return;
        }
        
        db.all(`
            SELECT tracks.*, artists.name as artist_name
            FROM tracks
            LEFT JOIN artists ON tracks.artist_id = artists.id
            WHERE tracks.album_id = ?
        `, [albumId], (err, tracks) => {
            if (err) {
                tracks = [];
            }
            res.render('album', { 
                title: album.title,
                album: album,
                tracks: tracks,
                activePage: 'albums'
            });
        });
    });
});

// Страница исполнителя
app.get('/artist/:id', (req, res) => {
    const artistId = req.params.id;
    
    db.get('SELECT * FROM artists WHERE id = ?', [artistId], (err, artist) => {
        if (err || !artist) {
            console.error('Исполнитель не найден:', err);
            res.redirect('/');
            return;
        }
        
        db.all('SELECT * FROM tracks WHERE artist_id = ?', [artistId], (err, tracks) => {
            if (err) {
                tracks = [];
            }
            
            db.all(`
                SELECT DISTINCT albums.* FROM albums
                JOIN tracks ON tracks.album_id = albums.id
                WHERE tracks.artist_id = ?
            `, [artistId], (err, albums) => {
                if (err) {
                    albums = [];
                }
                
                res.render('artist', { 
                    title: artist.name,
                    artist: artist,
                    tracks: tracks,
                    albums: albums,
                    activePage: null
                });
            });
        });
    });
});

// Страница загрузки
app.get('/upload', (req, res) => {
    res.render('upload', { 
        title: 'Загрузка',
        activePage: 'upload'
    });
});

// ============ API ============

// API для загрузки MP3 файлов
app.post('/api/upload', upload.array('files', 20), async (req, res) => {
    try {
        console.log('Получены файлы:', req.files?.length);
        const uploadedTracks = [];
        
        for (const file of req.files) {
            try {
                console.log('Обрабатываю файл:', file.originalname, file.mimetype, file.size);
                
                const metadata = await mm.parseFile(file.path);
                
                const title = metadata.common.title || path.basename(file.originalname, path.extname(file.originalname));
                const artistName = metadata.common.artist || 'Unknown Artist';
                const albumTitle = metadata.common.album || 'Unknown Album';
                const year = metadata.common.year || null;
                const duration = Math.round(metadata.format.duration || 180);
                
                let coverPath = null;
                if (metadata.common.picture && metadata.common.picture.length > 0) {
                    const picture = metadata.common.picture[0];
                    const coverName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.jpg';
                    const coverFullPath = path.join(__dirname, 'covers', coverName);
                    
                    console.log('Сохраняю обложку в:', coverFullPath);
                    
                    try {
                        fs.writeFileSync(coverFullPath, picture.data);
                        coverPath = '/covers/' + coverName;
                        console.log('Обложка сохранена:', coverPath);
                    } catch (error) {
                        console.error('Ошибка сохранения обложки:', error);
                    }
                } else {
                    console.log('Обложка не найдена в метаданных');
                }
                
                const artist = await getOrCreateArtist(artistName, coverPath);
                const album = await getOrCreateAlbum(albumTitle, artist.id, year, coverPath);
                
                const trackResult = await new Promise((resolve, reject) => {
                    db.run('INSERT INTO tracks (title, duration, file_path, album_id, artist_id) VALUES (?, ?, ?, ?, ?)',
                        [title, duration, '/uploads/' + file.filename, album.id, artist.id],
                        function(err) {
                            if (err) {
                                reject(err);
                                return;
                            }
                            resolve(this.lastID);
                        });
                });
                
                uploadedTracks.push({
                    id: trackResult,
                    title,
                    artist_name: artistName,
                    album_title: albumTitle,
                    duration
                });
                
            } catch (error) {
                console.error('Ошибка обработки файла:', file.originalname, error);
            }
        }
        
        res.json({
            success: true,
            message: `Загружено треков: ${uploadedTracks.length}`,
            tracks: uploadedTracks
        });
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка при загрузке файлов' 
        });
    }
});

// API для получения всех треков
app.get('/api/tracks', (req, res) => {
    db.all(`
        SELECT tracks.*, artists.name as artist_name, albums.title as album_title,
               albums.cover as album_cover
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
        SELECT tracks.*, artists.name as artist_name, albums.title as album_title,
               albums.cover as album_cover
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

// Запуск сервера
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
