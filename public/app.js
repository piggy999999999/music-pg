// Музыкальный плеер
class MusicPlayer {
    constructor() {
        this.audio = new Audio();
        this.tracks = [];
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        this.isRandom = true;
        
        this.init();
    }
    
    init() {
        // Получаем треки из глобальных переменных (если они есть)
        if (typeof allTracks !== 'undefined') {
            this.tracks = allTracks;
        } else if (typeof albumTracks !== 'undefined') {
            this.tracks = albumTracks;
        } else if (typeof artistTracks !== 'undefined') {
            this.tracks = artistTracks;
        }
        
        this.initPlayerControls();
        this.initTrackClicks();
        this.initAlbumPlayButtons();
        this.initArtistPlayButton();
        this.initSearch();
        this.initUpload();
        
        // Установка громкости
        this.setVolume(70);
        
        console.log('Плеер инициализирован. Треков:', this.tracks.length);
    }
    
    initPlayerControls() {
        const playBtn = document.getElementById('play-btn');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const progressBar = document.getElementById('progress-bar');
        const volumeBar = document.getElementById('volume-bar');
        
        if (playBtn) playBtn.addEventListener('click', () => this.togglePlay());
        if (prevBtn) prevBtn.addEventListener('click', () => this.prevTrack());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextTrack());
        if (progressBar) progressBar.addEventListener('input', (e) => this.seek(e.target.value));
        if (volumeBar) volumeBar.addEventListener('input', (e) => this.setVolume(e.target.value));
        
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.nextTrack());
        this.audio.addEventListener('loadedmetadata', () => this.updateProgress());
    }
    
    initTrackClicks() {
        document.querySelectorAll('.track-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Не срабатываем при клике на ссылку или кнопку
                if (e.target.closest('a') || e.target.closest('button')) return;
                
                const index = parseInt(item.getAttribute('data-track-index'));
                if (!isNaN(index)) {
                    this.playTrack(index);
                }
            });
            
            const playBtn = item.querySelector('.play-button');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(item.getAttribute('data-track-index'));
                    if (!isNaN(index)) {
                        this.playTrack(index);
                    }
                });
            }
        });
    }
    
    initAlbumPlayButtons() {
        document.querySelectorAll('.play-overlay').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const albumId = btn.getAttribute('data-album-id');
                if (albumId) {
                    this.loadAlbumTracks(albumId);
                }
            });
        });
        
        const playAlbumBtn = document.getElementById('play-album-btn');
        if (playAlbumBtn && typeof albumTracks !== 'undefined') {
            playAlbumBtn.addEventListener('click', () => {
                this.tracks = albumTracks;
                this.isRandom = false;
                this.playTrack(0);
            });
        }
    }
    
    initArtistPlayButton() {
        const playArtistBtn = document.getElementById('play-artist-btn');
        if (playArtistBtn && typeof artistTracks !== 'undefined') {
            playArtistBtn.addEventListener('click', () => {
                this.tracks = artistTracks;
                this.isRandom = true;
                this.shuffleTracks();
                this.playTrack(0);
            });
        }
    }
    
    async loadAlbumTracks(albumId) {
        try {
            const response = await fetch(`/api/albums/${albumId}`);
            const data = await response.json();
            this.tracks = data.tracks;
            this.isRandom = false;
            this.playTrack(0);
        } catch (error) {
            console.error('Ошибка загрузки треков альбома:', error);
        }
    }
    
    initSearch() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.searchTracks(e.target.value));
        }
    }
    
    initUpload() {
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const selectFilesBtn = document.getElementById('select-files-btn');
        
        if (!uploadArea || !fileInput || !selectFilesBtn) return;
        
        selectFilesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
        
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
        
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
            this.handleFiles(e.dataTransfer.files);
        });
    }
    
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
        
        this.uploadFiles(audioFiles);
    }
    
    async uploadFiles(files) {
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        
        const progressContainer = document.getElementById('upload-progress');
        const progressFill = document.getElementById('progress-fill');
        const uploadStatus = document.getElementById('upload-status');
        const resultsContainer = document.getElementById('upload-results');
        
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressFill) progressFill.style.width = '0%';
        if (uploadStatus) uploadStatus.textContent = `Загрузка ${files.length} файлов...`;
        if (resultsContainer) resultsContainer.innerHTML = '';
        
        try {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && progressFill) {
                    const percent = (e.loaded / e.total) * 100;
                    progressFill.style.width = percent + '%';
                    if (uploadStatus) uploadStatus.textContent = `Загрузка: ${Math.round(percent)}%`;
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    if (progressFill) progressFill.style.width = '100%';
                    if (uploadStatus) uploadStatus.textContent = response.message;
                    
                    if (resultsContainer) {
                        resultsContainer.innerHTML = '<h3>Загруженные треки:</h3>';
                        response.tracks.forEach(track => {
                            const div = document.createElement('div');
                            div.className = 'upload-result-item';
                            div.innerHTML = `
                                <div class="track-info">
                                    <div class="track-title">${track.title}</div>
                                    <div class="track-artist">${track.artist_name} • ${track.album_title}</div>
                                </div>
                                <span class="success-icon">✓</span>
                            `;
                            resultsContainer.appendChild(div);
                        });
                    }
                    
                    if (fileInput) fileInput.value = '';
                    
                    setTimeout(() => {
                        if (progressContainer) progressContainer.style.display = 'none';
                    }, 3000);
                    
                    // Предлагаем перезагрузить страницу
                    setTimeout(() => {
                        if (confirm('Треки загружены! Перезагрузить страницу для обновления списка?')) {
                            window.location.reload();
                        }
                    }, 3500);
                }
            });
            
            xhr.open('POST', '/api/upload', true);
            xhr.send(formData);
            
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            if (uploadStatus) uploadStatus.textContent = 'Ошибка при загрузке файлов';
        }
    }
    
    shuffleTracks() {
        if (this.isRandom && this.tracks.length > 0) {
            for (let i = this.tracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
            }
        }
    }
    
    playTrack(index) {
        if (index >= 0 && index < this.tracks.length) {
            this.currentTrackIndex = index;
            const track = this.tracks[index];
            
            console.log('Воспроизвожу трек:', track.title, track.file_path);
            
            const trackTitle = document.getElementById('track-title');
            const trackArtist = document.getElementById('track-artist');
            const trackImage = document.getElementById('track-image');
            
            if (trackTitle) trackTitle.textContent = track.title;
            if (trackArtist) trackArtist.textContent = track.artist_name || 'Неизвестный исполнитель';
            if (trackImage && track.album_cover) trackImage.src = track.album_cover;
            
            if (track.file_path) {
                this.audio.src = track.file_path;
                this.audio.play().catch(error => {
                    console.error('Ошибка воспроизведения:', error);
                });
                this.isPlaying = true;
                const playBtn = document.getElementById('play-btn');
                if (playBtn) playBtn.textContent = '⏸';
            }
        }
    }
    
    togglePlay() {
        if (this.tracks.length === 0) return;
        
        if (this.isPlaying) {
            this.audio.pause();
            const playBtn = document.getElementById('play-btn');
            if (playBtn) playBtn.textContent = '▶️';
        } else {
            this.audio.play().catch(error => {
                console.error('Ошибка воспроизведения:', error);
            });
            const playBtn = document.getElementById('play-btn');
            if (playBtn) playBtn.textContent = '⏸';
        }
        this.isPlaying = !this.isPlaying;
    }
    
    nextTrack() {
        if (this.tracks.length === 0) return;
        
        if (this.isRandom) {
            this.playTrack(Math.floor(Math.random() * this.tracks.length));
        } else {
            this.playTrack((this.currentTrackIndex + 1) % this.tracks.length);
        }
    }
    
    prevTrack() {
        if (this.tracks.length === 0) return;
        this.playTrack((this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length);
    }
    
    updateProgress() {
        if (this.audio.duration) {
            const progressBar = document.getElementById('progress-bar');
            const currentTime = document.getElementById('current-time');
            const totalTime = document.getElementById('total-time');
            
            if (progressBar) progressBar.value = (this.audio.currentTime / this.audio.duration) * 100;
            if (currentTime) currentTime.textContent = this.formatTime(this.audio.currentTime);
            if (totalTime) totalTime.textContent = this.formatTime(this.audio.duration);
        }
    }
    
    seek(value) {
        if (this.audio.duration) {
            this.audio.currentTime = (value / 100) * this.audio.duration;
        }
    }
    
    setVolume(value) {
        this.audio.volume = value / 100;
    }
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    async searchTracks(query) {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;
        
        if (query.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }
        
        try {
            const response = await fetch(`/api/tracks/search?q=${encodeURIComponent(query)}`);
            const tracks = await response.json();
            
            resultsContainer.innerHTML = '';
            
            if (tracks.length === 0) {
                resultsContainer.innerHTML = '<p>Ничего не найдено</p>';
                return;
            }
            
            tracks.forEach((track, index) => {
                const div = document.createElement('div');
                div.className = 'track-item';
                div.innerHTML = `
                    <div>
                        <a href="/artist/${track.artist_id}" class="artist-link">${track.artist_name}</a>
                        - ${track.title}
                    </div>
                    <button class="play-button" data-index="${index}">▶</button>
                `;
                
                div.querySelector('.play-button').addEventListener('click', () => {
                    this.tracks = tracks;
                    this.playTrack(index);
                });
                
                resultsContainer.appendChild(div);
            });
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.player = new MusicPlayer();
});
