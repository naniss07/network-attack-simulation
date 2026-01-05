# Network Simulation Project

Bu proje ağ simülasyonu için geliştirilmiş bir web uygulamasıdır.

## Docker ile Çalıştırma

### 1. Docker Image Oluşturma
```bash
docker build -t network-simulation .
```

### 2. Container Çalıştırma
```bash
docker run -p 5028:5028 network-simulation
```

### 3. Docker Compose ile Çalıştırma
```bash
docker-compose up -d
```

## Yerel Geliştirme

### 1. Bağımlılıkları Yükleme
```bash
npm install
```

### 2. Uygulamayı Başlatma
```bash
npm start
```

### 3. Geliştirme Modu
```bash
npm run dev
```

## Erişim

Uygulama http://localhost:5028 adresinde çalışacaktır.

## Port Yapılandırması

- **Port**: 5028
- **Protokol**: HTTP
- **Erişim**: http://localhost:5028 veya http://sunucu-ip:5028

"# IP-SPOOF-NG" 
"# network-attack-simulation" 
