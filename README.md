## Network Attack Simulation

Etkileşimli ağ saldırı simülasyonu. DoS, DDoS, ARP Spoofing, IP Spoofing ve DNS Spoofing senaryolarını görsel olarak gösteren, tamamen istemci tarafında çalışan (serverless) bir web uygulaması.

---

## Hızlı Başlangıç (Serverless / Sadece Tarayıcı)

Bu proje **sadece statik dosyalarla** da çalışır; Node.js veya Docker zorunlu değildir.

1. `simulation/index.html` dosyasını tarayıcıda aç.
2. Tüm ağ topolojisi, animasyonlar ve saldırı senaryoları doğrudan çalışır.

Canlıya almak için, `simulation` klasörünü herhangi bir statik hosting’e (Vercel, Netlify, GitHub Pages vb.) root dizini olarak yüklemen yeterlidir.

---

## Node.js ile Çalıştırma (Opsiyonel)

Yerelde küçük bir Express sunucusu üzerinden çalıştırmak istersen:

### 1. Bağımlılıkları yükle
```bash
npm install
```

### 2. Uygulamayı başlat
```bash
npm start
```

Varsayılan olarak uygulama `http://localhost:5028` adresinde çalışır ve `simulation/` klasörünü servis eder.

Geliştirme sırasında otomatik yeniden başlatma için:
```bash
npm run dev
```

---

## Docker ile Çalıştırma (Tamamen Opsiyonel)

### 1. Docker imajı oluştur
```bash
docker build -t network-simulation .
```

### 2. Container çalıştır
```bash
docker run -p 5028:5028 network-simulation
```

### 3. Docker Compose ile
```bash
docker-compose up -d
```

Container içinde de uygulama `http://localhost:5028` üzerinden erişilebilir olur.

---

## Port Bilgisi

- **HTTP portu**: `5028` (Node.js veya Docker kullanıyorsan)
- Saf statik hosting kullanıyorsan, port hosting sağlayıcısına göre değişir.
