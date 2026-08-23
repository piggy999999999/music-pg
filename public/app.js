// Музыкальный плеер
class MusicPlayer {
    constructor() {
        this.audio = new Audio();
        this.tracks = [];
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        this.isRandom = true;
        
        this.initEventListeners();
        this.loadAllTracks();
        this.loadAlbums();
    }
    
    // Инициализация обработчиков событий
    initEventListeners() {
        // Навигация
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                this.navigate(page);
            });
        });
        
        // Управление плеером
        document.getElementById('play-btn').addEventListener('click', () => this.togglePlay());
        document.getElementById('prev-btn').addEventListener('click', () => this.prevTrack());
        document.getElementById('next-btn').addEventListener('click', () => this.nextTrack());
        
        // Прогресс и громкость
        document.getElementById('progress-bar').addEventListener('input', (e) => this.seek(e.target.value));
        document.getElementById('volume-bar').addEventListener('input', (e) => this.setVolume(e.target.value));
        
        // События аудио
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.nextTrack());
        this.audio.addEventListener('loadedmetadata', () => this.updateProgress());
        
        // Поиск
        document.getElementById('search-input').addEventListener('input', (e) => this.searchTracks(e.target.value));
        
        // Загрузка файлов
        this.initUploadListeners();
        
        // Установка начальной громкости
        this.setVolume(70);
    }
    
    // Инициализация загрузки файлов
    initUploadListeners() {
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const selectFilesBtn = document.getElementById('select-files-btn');
        
        if (!uploadArea || !fileInput || !selectFilesBtn) {
            console.error('Элементы загрузки не найдены');
            return;
        }
        
        // Открытие диалога выбора файлов
        selectFilesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
        
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Выбор файлов через диалог
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });
    }
    
    // Обработка выбранных файлов
    handleFiles(files) {
        const allowedExtensions = ['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus'];
        
        const audioFiles = Array.from(files).filter(file => {
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            return file.type.startsWith('audio/') || allowedExtensions.includes(extension);
        });
        
        if (audioFiles.length === 0) {
            alert('Пожалуйста, выберите аудиофайлы (MP3, M4A, FLAC, WAV, OGG)!');
            return;
        }
        
        console.log('Найдено аудиофайлов:', audioFiles.length);
        this.uploadFiles(audioFiles);
    }
    
    // Загрузка файлов на сервер
    async uploadFiles(files) {
        console.log('Начинаю загрузку файлов:', files.length);
        
        const formData = new FormData();
        
        files.forEach(file => {
            console.log('Добавляю файл:', file.name, file.type, file.size);
            formData.append('files', file);
        });
        
        // Показываем прогресс
        const progressContainer = document.getElementById('upload-progress');
        const progressFill = document.getElementById('progress-fill');
        const uploadStatus = document.getElementById('upload-status');
        const resultsContainer = document.getElementById('upload-results');
        
        progressContainer.style.display = 'block';
        progressFill.style.width = '0%';
        uploadStatus.textContent = `Подготовка к загрузке ${files.length} файлов...`;
        resultsContainer.innerHTML = '';
        
        try {
            const xhr = new XMLHttpRequest();
            
            // Отслеживаем прогресс загрузки
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    progressFill.style.width = percentComplete + '%';
                    uploadStatus.textContent = `Загрузка: ${Math.round(percentComplete)}%`;
                }
            });
            
            // Обработка ответа
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    
                    progressFill.style.width = '100%';
                    uploadStatus.textContent = response.message;
                    
                    // Показываем результаты
                    this.displayUploadResults(response.tracks);
                    
                    // Обновляем список треков
                    this.loadAllTracks();
                    this.loadAlbums();
                    
                    // Очищаем input
                    document.getElementById('file-input').value = '';
                    
                    // Скрываем прогресс через 3 секунды
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                    }, 3000);
                    
                } else {
                    uploadStatus.textContent = 'Ошибка при загрузке файлов';
                    progressFill.style.width = '0%';
                }
            });
            
            // Обработка ошибок
            xhr.addEventListener('error', () => {
                uploadStatus.textContent = 'Ошибка сети при загрузке';
                progressFill.style.width = '0%';
            });
            
            // Отправляем файлы
            xhr.open('POST', '/api/upload', true);
            xhr.send(formData);
            
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            uploadStatus.textContent = 'Ошибка при загрузке файлов';
            progressFill.style.width = '0%';
        }
    }
    
    // Отображение результатов загрузки
    displayUploadResults(tracks) {
        const resultsContainer = document.getElementById('upload-results');
        resultsContainer.innerHTML = '<h3>Загруженные треки:</h3>';
        
        if (!tracks || tracks.length === 0) {
            resultsContainer.innerHTML += '<p>Нет загруженных треков</p>';
            return;
        }
        
        tracks.forEach(track => {
            const trackElement = document.createElement('div');
            trackElement.className = 'upload-result-item';
            trackElement.innerHTML = `
                <div class="track-info">
                    <div class="track-title">${track.title}</div>
                    <div class="track-artist">${track.artist_name} • ${track.album_title}</div>
                </div>
                <span class="success-icon">✓</span>
            `;
            resultsContainer.appendChild(trackElement);
        });
    }
    
    // Навигация по страницам
    navigate(page) {
        console.log('Навигация на страницу:', page);
        
        // Скрываем все секции
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        
        // Убираем активный класс у всех ссылок
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        
        // Показываем нужную секцию
        const targetSection = document.getElementById(page);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        // Отмечаем активную ссылку
        const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }
    
    // Загрузка всех треков
    async loadAllTracks() {
        try {
            const response = await fetch('/api/tracks');
            this.tracks = await response.json();
            console.log('Загружено треков:', this.tracks.length);
            this.shuffleTracks();
        } catch (error) {
            console.error('Ошибка загрузки треков:', error);
        }
    }
    
    // Перемешивание треков
    shuffleTracks() {
        if (this.isRandom && this.tracks.length > 0) {
            for (let i = this.tracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
            }
        }
    }
    
        // Воспроизведение трека
    playTrack(index) {
        if (index >= 0 && index < this.tracks.length) {
            this.currentTrackIndex = index;
            const track = this.tracks[index];
            
            console.log('Воспроизвожу трек:', track);
            
            // Обновляем информацию о треке
            document.getElementById('track-title').textContent = track.title;
            document.getElementById('track-artist').textContent = track.artist_name;
            
            // Устанавливаем обложку альбома
            if (track.album_cover) {
                console.log('Обложка:', track.album_cover);
                document.getElementById('track-image').src = track.album_cover;
            }
            
            // Устанавливаем аудиофайл
            if (track.file_path) {
                console.log('Путь к файлу:', track.file_path);
                
                // Создаем новый Audio элемент для избежания проблем
                this.audio = new Audio();
                
                // Добавляем обработчики
                this.audio.addEventListener('timeupdate', () => this.updateProgress());
                this.audio.addEventListener('ended', () => this.nextTrack());
                this.audio.addEventListener('loadedmetadata', () => this.updateProgress());
                
                // Пробуем разные форматы
                const fileExt = track.file_path.split('.').pop().toLowerCase();
                console.log('Расширение файла:', fileExt);
                
                // Для M4A файлов пробуем разные MIME типы
                if (fileExt === 'm4a') {
                    // Создаем source элементы для разных форматов
                    const source = document.createElement('source');
                    source.src = track.file_path;
                    source.type = 'audio/mp4';
                    this.audio.appendChild(source);
                    
                    // Запасной вариант
                    const source2 = document.createElement('source');
                    source2.src = track.file_path;
                    source2.type = 'audio/aac';
                    this.audio.appendChild(source2);
                } else {
                    this.audio.src = track.file_path;
                }
                
                this.audio.load();
                
                this.audio.play()
                    .then(() => {
                        console.log('Воспроизведение началось');
                        this.isPlaying = true;
                        document.getElementById('play-btn').textContent = '⏸';
                    })
                    .catch(error => {
                        console.error('Ошибка воспроизведения:', error);
                        
                        // Пробуем альтернативный способ
                        this.tryAlternativePlayback(track);
                    });
            } else {
                console.log('Нет пути к файлу, использую заглушку');
                this.audio.src = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
                this.audio.play();
                this.isPlaying = true;
                document.getElementById('play-btn').textContent = '⏸';
            }
        }
    }
    
    // Альтернативный способ воспроизведения
    tryAlternativePlayback(track) {
        console.log('Пробую альтернативное воспроизведение');
        
        // Пробуем через fetch и blob
        fetch(track.file_path)
            .then(response => response.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                this.audio.src = url;
                return this.audio.play();
            })
            .then(() => {
                console.log('Альтернативное воспроизведение сработало');
                this.isPlaying = true;
                document.getElementById('play-btn').textContent = '⏸';
            })
            .catch(error => {
                console.error('Все способы не сработали:', error);
                alert('Не удалось воспроизвести файл. Формат может не поддерживаться браузером.');
            });
    }
            
            // Обновляем информацию о треке
            document.getElementById('track-title').textContent = track.title;
            document.getElementById('track-artist').textContent = track.artist_name;
            
            // Устанавливаем обложку альбома
            if (track.album_cover) {
                document.getElementById('track-image').src = track.album_cover;
            }
            
            // Устанавливаем аудиофайл
            if (track.file_path) {
                console.log('Путь к файлу:', track.file_path);
                this.audio.src = track.file_path;
                this.audio.load();
                
                this.audio.play()
                    .then(() => {
                        console.log('Воспроизведение началось');
                        this.isPlaying = true;
                        document.getElementById('play-btn').textContent = '⏸';
                    })
                    .catch(error => {
                        console.error('Ошибка воспроизведения:', error);
                        alert('Не удалось воспроизвести файл. Возможно, он был удален с сервера.');
                    });
            } else {
                console.log('Нет пути к файлу, использую заглушку');
                this.audio.src = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
                this.audio.play();
                this.isPlaying = true;
                document.getElementById('play-btn').textContent = '⏸';
            }
        }
    }
    
    // Переключение воспроизведения
    togglePlay() {
        if (this.tracks.length === 0) return;
        
        if (this.isPlaying) {
            this.audio.pause();
            document.getElementById('play-btn').textContent = '▶️';
        } else {
            if (!this.audio.src) {
                this.playTrack(this.currentTrackIndex);
            } else {
                this.audio.play();
                document.getElementById('play-btn').textContent = '⏸';
            }
        }
        this.isPlaying = !this.isPlaying;
    }
    
    // Следующий трек
    nextTrack() {
        if (this.tracks.length === 0) return;
        
        if (this.isRandom) {
            this.playTrack(Math.floor(Math.random() * this.tracks.length));
        } else {
            this.playTrack((this.currentTrackIndex + 1) % this.tracks.length);
        }
    }
    
    // Предыдущий трек
    prevTrack() {
        if (this.tracks.length === 0) return;
        this.playTrack((this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length);
    }
    
    // Обновление прогресса
    updateProgress() {
        if (this.audio.duration) {
            const progress = (this.audio.currentTime / this.audio.duration) * 100;
            document.getElementById('progress-bar').value = progress;
            
            document.getElementById('current-time').textContent = this.formatTime(this.audio.currentTime);
            document.getElementById('total-time').textContent = this.formatTime(this.audio.duration);
        }
    }
    
    // Перемотка
    seek(value) {
        if (this.audio.duration) {
            const time = (value / 100) * this.audio.duration;
            this.audio.currentTime = time;
        }
    }
    
    // Установка громкости
    setVolume(value) {
        this.audio.volume = value / 100;
    }
    
    // Форматирование времени
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Поиск треков
    async searchTracks(query) {
        if (query.length < 2) {
            document.getElementById('search-results').innerHTML = '';
            return;
        }
        
        try {
            const response = await fetch(`/api/tracks/search?q=${encodeURIComponent(query)}`);
            const tracks = await response.json();
            this.displaySearchResults(tracks);
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    }
    
    // Отображение результатов поиска
    displaySearchResults(tracks) {
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = '';
        
        if (tracks.length === 0) {
            resultsContainer.innerHTML = '<p>Ничего не найдено</p>';
            return;
        }
        
        tracks.forEach(track => {
            const trackElement = document.createElement('div');
            trackElement.className = 'track-item';
            trackElement.innerHTML = `
                <div>
                    <span class="artist-link" data-artist-id="${track.artist_id}">${track.artist_name}</span>
                    - ${track.title}
                </div>
                <button class="play-button" data-track-id="${track.id}">▶</button>
            `;
            
            trackElement.querySelector('.artist-link').addEventListener('click', () => {
                this.viewArtist(track.artist_id);
            });
            
            trackElement.querySelector('.play-button').addEventListener('click', () => {
                const index = this.tracks.findIndex(t => t.id === track.id);
                if (index !== -1) {
                    this.playTrack(index);
                }
            });
            
            resultsContainer.appendChild(trackElement);
        });
    }
    
    // Загрузка списка альбомов
    async loadAlbums() {
        try {
            const response = await fetch('/api/albums');
            const albums = await response.json();
            this.displayAlbums(albums);
        } catch (error) {
            console.error('Ошибка загрузки альбомов:', error);
        }
    }
    
    // Отображение альбомов
    displayAlbums(albums) {
        const albumsGrid = document.getElementById('albums-grid');
        albumsGrid.innerHTML = '';
        
        albums.forEach(album => {
            const albumCard = document.createElement('div');
            albumCard.className = 'album-card';
            albumCard.innerHTML = `
                <img src="${album.cover || 'https://via.placeholder.com/200x200/333/fff?text=Album'}" alt="${album.title}">
                <div class="album-info">
                    <div class="album-title">${album.title}</div>
                    <div class="album-year">${album.year} • ${album.track_count} треков</div>
                    <div class="album-year">${album.artist_name}</div>
                </div>
                <div class="play-overlay">▶</div>
            `;
            
            albumCard.addEventListener('click', (e) => {
                if (!e.target.classList.contains('play-overlay')) {
                    this.viewAlbum(album.id);
                }
            });
            
            albumCard.querySelector('.play-overlay').addEventListener('click', () => {
                this.playAlbum(album.id);
            });
            
            albumsGrid.appendChild(albumCard);
        });
    }
    
    // Просмотр страницы исполнителя
    async viewArtist(artistId) {
        try {
            const response = await fetch(`/api/artists/${artistId}`);
            const data = await response.json();
            this.displayArtistPage(data);
            this.navigate('artist-page');
        } catch (error) {
            console.error('Ошибка загрузки исполнителя:', error);
        }
    }
    
    // Отображение страницы исполнителя
    displayArtistPage(data) {
        const artistInfo = document.getElementById('artist-info');
        artistInfo.innerHTML = `
            <div class="artist-header">
                <img src="${data.artist.photo || 'https://via.placeholder.com/200x200/333/fff?text=Artist'}" alt="${data.artist.name}">
                <div>
                    <h1>${data.artist.name}</h1>
                    <button class="artist-play-btn">▶️ Играть все</button>
                </div>
            </div>
        `;
        
        artistInfo.querySelector('.artist-play-btn').addEventListener('click', () => {
            this.tracks = data.tracks;
            this.isRandom = true;
            this.shuffleTracks();
            this.playTrack(0);
        });
        
        const artistTracks = document.getElementById('artist-tracks');
        artistTracks.innerHTML = '<h2>Треки</h2>';
        
        data.tracks.forEach(track => {
            const trackElement = document.createElement('div');
            trackElement.className = 'track-item';
            trackElement.innerHTML = `
                <span>${track.title}</span>
                <button class="play-button" data-track-id="${track.id}">▶</button>
            `;
            
            trackElement.querySelector('.play-button').addEventListener('click', () => {
                this.tracks = data.tracks;
                const index = this.tracks.findIndex(t => t.id === track.id);
                if (index !== -1) {
                    this.playTrack(index);
                }
            });
            
            artistTracks.appendChild(trackElement);
        });
        
        const artistAlbums = document.getElementById('artist-albums');
        artistAlbums.innerHTML = '<h2>Альбомы</h2>';
        
        const albumsGrid = document.createElement('div');
        albumsGrid.id = 'artist-albums-grid';
        albumsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;';
        
        data.albums.forEach(album => {
            const albumCard = document.createElement('div');
            albumCard.className = 'album-card';
            albumCard.innerHTML = `
                <img src="${album.cover || 'https://via.placeholder.com/200x200/333/fff?text=Album'}" alt="${album.title}">
                <div class="album-info">
                    <div class="album-title">${album.title}</div>
                    <div class="album-year">${album.year}</div>
                </div>
            `;
            
            albumCard.addEventListener('click', () => {
                this.viewAlbum(album.id);
            });
            
            albumsGrid.appendChild(albumCard);
        });
        
        artistAlbums.appendChild(albumsGrid);
    }
    
    // Просмотр страницы альбома
    async viewAlbum(albumId) {
        try {
            const response = await fetch(`/api/albums/${albumId}`);
            const data = await response.json();
            this.displayAlbumPage(data);
            this.navigate('album-page');
        } catch (error) {
            console.error('Ошибка загрузки альбома:', error);
        }
    }
    
    // Отображение страницы альбома
    displayAlbumPage(data) {
        const albumInfo = document.getElementById('album-info');
        albumInfo.innerHTML = `
            <div class="artist-header">
                <img src="${data.album.cover || 'https://via.placeholder.com/200x200/333/fff?text=Album'}" alt="${data.album.title}" style="border-radius: 10px;">
                <div>
                    <h1>${data.album.title}</h1>
                    <p style="color: #b3b3b3; margin-bottom: 10px;">${data.album.artist_name} • ${data.album.year}</p>
                    <button class="artist-play-btn">▶️ Играть альбом</button>
                </div>
            </div>
        `;
        
        albumInfo.querySelector('.artist-play-btn').addEventListener('click', () => {
            this.tracks = data.tracks;
            this.isRandom = false;
            this.playTrack(0);
        });
        
        const albumTracks = document.getElementById('album-tracks');
        albumTracks.innerHTML = '<h2>Треки</h2>';
        
        data.tracks.forEach(track => {
            const trackElement = document.createElement('div');
            trackElement.className = 'track-item';
            trackElement.innerHTML = `
                <div>
                    <span>${track.title}</span>
                    <span class="artist-link" data-artist-id="${track.artist_id}" style="margin-left: 10px; font-size: 14px;">
                        ${track.artist_name}
                    </span>
                </div>
                <button class="play-button" data-track-id="${track.id}">▶</button>
            `;
            
            trackElement.querySelector('.artist-link').addEventListener('click', () => {
                this.viewArtist(track.artist_id);
            });
            
            trackElement.querySelector('.play-button').addEventListener('click', () => {
                this.tracks = data.tracks;
                const index = this.tracks.findIndex(t => t.id === track.id);
                if (index !== -1) {
                    this.playTrack(index);
                }
            });
            
            albumTracks.appendChild(trackElement);
        });
    }
    
    // Воспроизведение альбома
    async playAlbum(albumId) {
        try {
            const response = await fetch(`/api/albums/${albumId}`);
            const data = await response.json();
            this.tracks = data.tracks;
            this.isRandom = false;
            this.playTrack(0);
        } catch (error) {
            console.error('Ошибка воспроизведения альбома:', error);
        }
    }
}

// Инициализация плеера
const player = new MusicPlayer();
