# Node.js tabanlı web sunucusu kullanacağız
FROM node:18-alpine

# Çalışma dizinini belirle
WORKDIR /app

# Package.json dosyasını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm install

# Uygulama dosyalarını kopyala
COPY . .

# Port 5028'i aç
EXPOSE 5028

# Uygulamayı başlat
CMD ["npm", "start"] 