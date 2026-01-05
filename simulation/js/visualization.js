// Cihaz tipleri ve ikon yolları
const DEVICE_TYPES = {
  client:    { img: 'images/client.png',   label: 'Client' },
  switch:    { img: 'images/switch.png',   label: 'Switch' },
  router:    { img: 'images/router.png',   label: 'Router' },
  webserver: { img: 'images/cloud.png',label: 'Web Server' },
  dns:       { img: 'images/dns.png',      label: 'DNS Server' },
  attacker:  { img: 'images/attacker.png', label: 'Attacker' },
};

// Topoloji: DNS Spoofing için örnek cihazlar ve bağlantılar
const devices = [
  // Network 1 (10.0.0.0/24)
  { id: 1, type: 'client',    x: 200,  y: 200, 
    ip: '10.0.0.10', 
    mac: 'AA:BB:CC:01',
    gateway: '10.0.0.1'  // Default Gateway
  },
  { id: 3, type: 'switch',    x: 400,  y: 200, 
    macTable: {
      'AA:BB:CC:01': 'Port 1',  // Client 1
      'AA:BB:CC:0B': 'Port 2'   // Attacker (yalnızca bu LAN'a bağlı)
    }
  },

  // Network 2 (172.16.0.0/24)
  { id: 2, type: 'client',    x: 200,  y: 400, 
    ip: '172.16.0.10', 
    mac: 'AA:BB:CC:02',
    gateway: '172.16.0.1'  // Default Gateway
  },
  { id: 4, type: 'switch',    x: 400,  y: 400, 
    macTable: {
      'AA:BB:CC:02': 'Port 1'   // Client 2
    }
  },

  // Router (4 interface'li) - Aşağı kaydırıldı
  { id: 5, type: 'router',    x: 600,  y: 250, 
    ip: { 
      eth0: '10.0.0.1',     // Network 1 interface
      eth1: '172.16.0.1',   // Network 2 interface
      eth2: '192.168.1.1',  // DMZ Network 1 interface
      eth3: '192.168.2.1'   // DMZ Network 2 interface
    }, 
    mac: {
      eth0: 'AA:BB:CC:05',
      eth1: 'AA:BB:CC:06',
      eth2: 'AA:BB:CC:07',
      eth3: 'AA:BB:CC:08'
    },
    gateway: {
      eth0: '0.0.0.0',     // Router'ın kendi interface'i
      eth1: '0.0.0.0',     // Router'ın kendi interface'i
      eth2: '0.0.0.0',     // Router'ın kendi interface'i
      eth3: '0.0.0.0'      // Router'ın kendi interface'i
    }
  },

  // DMZ Network 1 (192.168.1.0/24)
  { id: 6, type: 'switch',    x: 800,  y: 200, 
    macTable: {
      'AA:BB:CC:09': 'Port 1'   // Web Server
    }
  },
  { id: 8, type: 'webserver', x: 1000, y: 200, 
    ip: '192.168.1.100', 
    mac: 'AA:BB:CC:09',
    gateway: '192.168.1.1'  // Default Gateway
  },

  // DMZ Network 2 (192.168.2.0/24)
  { id: 7, type: 'switch',    x: 800,  y: 400, 
    macTable: {
      'AA:BB:CC:0A': 'Port 1'   // DNS Server
    }
  },
  { id: 9, type: 'dns',       x: 1000, y: 400, 
    ip: '192.168.2.53',  
    mac: 'AA:BB:CC:0A',
    gateway: '192.168.2.1'  // Default Gateway
  },
  
  // Network 1'deki Attacker
  { id: 10, type: 'attacker', x: 600,  y: 500, 
    ip: '10.0.0.66',     
    mac: 'AA:BB:CC:0B',
    gateway: '10.0.0.1'  // Default Gateway
  },
];

const links = [
  [1,3], [2,4],    // Clients to switches
  [3,5], [4,5],    // Switches to router
  [5,6], [5,7],    // Router to switches
  [6,8], [7,9],    // Switches to servers
  [3,10]           // Attacker sadece üst LAN switch'ine bağlı
];

// Varsayılan topolojiyi kopyala (geri yüklemek için)
const DEFAULT_DEVICES = devices.map(d => ({
  ...d,
  ip: (d.ip && typeof d.ip === 'object') ? { ...d.ip } : d.ip,
  mac: (d.mac && typeof d.mac === 'object') ? { ...d.mac } : d.mac,
  gateway: (d.gateway && typeof d.gateway === 'object') ? { ...d.gateway } : d.gateway,
  macTable: d.macTable ? { ...d.macTable } : undefined,
}));
const DEFAULT_LINKS = links.map(([a,b]) => [a,b]);

function setTopologyDefault() {
  devices.length = 0;
  DEFAULT_DEVICES.forEach(d => {
    const copy = { ...d };
    if (d.ip && typeof d.ip === 'object') copy.ip = { ...d.ip };
    if (d.mac && typeof d.mac === 'object') copy.mac = { ...d.mac };
    if (d.gateway && typeof d.gateway === 'object') copy.gateway = { ...d.gateway };
    if (d.macTable) copy.macTable = { ...d.macTable };
    devices.push(copy);
  });
  links.length = 0;
  DEFAULT_LINKS.forEach(l => links.push([l[0], l[1]]));
  renderNetwork();
}

function setTopologyDefaultNoAttacker() {
  devices.length = 0;
  links.length = 0;
  // Saldırgan düğümlerin id ve MAC'lerini topla
  const attackerIds = new Set();
  const attackerMacs = new Set();
  DEFAULT_DEVICES.forEach(d => {
    if (d.type === 'attacker') {
      attackerIds.add(d.id);
      if (d.mac) {
        if (typeof d.mac === 'object') {
          Object.values(d.mac).forEach(m => { if (m) attackerMacs.add(m); });
        } else {
          attackerMacs.add(d.mac);
        }
      }
    }
  });
  // Cihazları saldırganlar olmadan kopyala, switch MAC tablolarından da temizle
  DEFAULT_DEVICES.forEach(d => {
    if (attackerIds.has(d.id) || d.type === 'attacker') return;
    const copy = { ...d };
    if (d.ip && typeof d.ip === 'object') copy.ip = { ...d.ip };
    if (d.mac && typeof d.mac === 'object') copy.mac = { ...d.mac };
    if (d.gateway && typeof d.gateway === 'object') copy.gateway = { ...d.gateway };
    if (d.macTable) {
      const filtered = {};
      for (const [mac, port] of Object.entries(d.macTable)) {
        if (!attackerMacs.has(mac)) filtered[mac] = port;
      }
      copy.macTable = filtered;
    }
    devices.push(copy);
  });
  // Bağlantılardan saldırgan düğümlerini çıkar
  DEFAULT_LINKS.forEach(([a, b]) => {
    if (attackerIds.has(a) || attackerIds.has(b)) return;
    links.push([a, b]);
  });
  renderNetwork();
}

// YENİ: ARP Spoofing ve IP Spoofing için - Attacker alt LAN'da (Client 2 ile aynı)
function setTopologyDefaultAttackerLower() {
  devices.length = 0;
  links.length = 0;
  
  // Varsayılan cihazları kopyala
  DEFAULT_DEVICES.forEach(d => {
    const copy = { ...d };
    if (d.ip && typeof d.ip === 'object') copy.ip = { ...d.ip };
    if (d.mac && typeof d.mac === 'object') copy.mac = { ...d.mac };
    if (d.gateway && typeof d.gateway === 'object') copy.gateway = { ...d.gateway };
    if (d.macTable) copy.macTable = { ...d.macTable };
    
    // Attacker'ı alt LAN IP bloğuna taşı (172.16.0.0/24)
    if (d.id === 10 && d.type === 'attacker') {
      copy.ip = '172.16.0.66';
      copy.gateway = '172.16.0.1';
    }
    
    // Attacker'ı alt LAN IP bloğuna taşı (172.16.0.0/24)
    if (d.id === 10 && d.type === 'attacker') {
      copy.ip = '172.16.0.66';
      copy.gateway = '172.16.0.1';
    }
    
    // Switch 3'ün MAC tablosundan attacker'ı çıkar
    if (d.id === 3) {
      copy.macTable = {
        'AA:BB:CC:01': 'Port 1'  // Sadece Client 1
      };
    }
    
    // Switch 4'ün MAC tablosuna attacker ekle
    if (d.id === 4) {
      copy.macTable = {
        'AA:BB:CC:02': 'Port 1',   // Client 2
        'AA:BB:CC:0B': 'Port 2'    // Attacker (YENİ!)
      };
    }
    
    devices.push(copy);
  });
  
  // Bağlantıları kopyala ama [3,10] yerine [4,10] kullan
  DEFAULT_LINKS.forEach(([a, b]) => {
    // [3,10] bağlantısını atla (attacker-switch3)
    if ((a === 3 && b === 10) || (a === 10 && b === 3)) return;
    links.push([a, b]);
  });
  
  // Attacker'ı switch 4'e bağla (alt LAN)
  links.push([4, 10]);
  
  renderNetwork();
}

function setTopologyDoS() {
  devices.length = 0;
  links.length = 0;
  devices.push(
    // Ortak switch
    { id: 204, type: 'switch', x: 420, y: 300, macTable: {} },
    { id: 205, type: 'router', x: 600, y: 300,
      ip: { eth0: '10.0.0.1', eth1: '0.0.0.0', eth2: '192.168.1.1', eth3: '0.0.0.0' },
      mac: { eth0: 'AA:BB:CC:05', eth1: '-', eth2: 'AA:BB:CC:07', eth3: '-' },
      gateway: { eth0: '0.0.0.0', eth1: '0.0.0.0', eth2: '0.0.0.0', eth3: '0.0.0.0' }
    },
    { id: 208, type: 'webserver', x: 980, y: 300, ip: '192.168.1.100', mac: 'AA:BB:CC:09', gateway: '192.168.1.1' },
    // Attacker (aynı LAN)
    { id: 200, type: 'attacker', x: 220, y: 420, ip: '10.0.0.66', mac: 'AA:BB:CC:0B', gateway: '10.0.0.1' }
  );
  // Bağlantılar: attacker->switch, switch->router, router->server
  links.push([200,204],[204,205],[205,208]);
  renderNetwork();
}

function setTopologyDDoS() {
  devices.length = 0;
  links.length = 0;
  // Botnet LAN 10.0.1.0/24
  // Infrastructure ID'leri: 320-329 (zombie ID'leri 301-310 ile çakışmayacak şekilde)
  devices.push(
    { id: 320, type: 'switch', x: 460, y: 300, macTable: {} },
    { id: 321, type: 'router', x: 680, y: 300,
      ip: { eth0: '10.0.1.1', eth1: '0.0.0.0', eth2: '192.168.1.1', eth3: '0.0.0.0' },
      mac: { eth0: 'AA:BB:DD:20', eth1: '-', eth2: 'AA:BB:DD:21', eth3: '-' },
      gateway: { eth0: '0.0.0.0', eth1: '0.0.0.0', eth2: '0.0.0.0', eth3: '0.0.0.0' }
    },
    { id: 322, type: 'webserver', x: 1040, y: 300, ip: '192.168.1.100', mac: 'AA:BB:CC:09', gateway: '192.168.1.1' },
    { id: 300, type: 'attacker', x: 200, y: 500, ip: '10.0.1.5', mac: 'AA:BB:DD:00', gateway: '10.0.1.1' }
  );
  // Zombies 301..310
  (function placeZombiesInLeftZone() {
    const canvas = document.getElementById('networkCanvas');
    const W = canvas ? canvas.width : 1100;
    const H = canvas ? canvas.height : 600;
    // Sol bölge: toplam genişliğin ~%38'i (min 360, max 440), üstten 110, satır aralığı 170
    const leftZoneWidth = Math.max(360, Math.min(440, Math.floor(W * 0.38)));
    const marginX = 70;
    const xStart = marginX;
    const xEnd = leftZoneWidth - marginX;
    const cols = 5;
    const rows = 2;
    const xStep = (xEnd - xStart) / (cols - 1);
    const yTop = 120;
    const rowStep = 170;
    for (let i = 0; i < 10; i++) {
      const id = 301 + i;
      const ipOctet = 10 + i;
      const macEnd = (i+1).toString().padStart(2,'0');
      const col = i % cols;
      const row = Math.floor(i / cols);
      const jitter = (i % 2 === 0) ? -8 : 8;
      const x = xStart + col * xStep;
      const y = yTop + row * rowStep + jitter;
      devices.push({
        id, type: 'client', x, y,
        size: 50,
        name: `Zombie ${i+1}`,
        ip: `10.0.1.${ipOctet}`,
        mac: `AA:BB:DD:${macEnd}`,
        gateway: '10.0.1.1',
        compact: true
      });
      links.push([id,320]);  // Tüm zombiler 320 ID'li switch'e bağlı
    }
  })();
  // Connect attacker and infrastructure
  links.push([300,320],[320,321],[321,322]);  // ID'ler güncellendi: 320=switch, 321=router, 322=webserver
  renderNetwork();
}

// İkonları önceden yükle
const loadedImages = {};
let imagesLoaded = 0;
const totalImages = Object.keys(DEVICE_TYPES).length;

// Hover durumunu takip etmek için
let hoveredDevice = null;
// Çizimde yerleşen bilgi kutularını takip (çakışmayı önlemek için)
let drawnInfoBoxes = [];

function loadImages() {
  return new Promise((resolve, reject) => {
    for (const key in DEVICE_TYPES) {
      const img = new Image();
      img.onload = () => {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
          resolve();
        }
      };
      img.onerror = () => {
        console.warn(`Failed to load image: ${DEVICE_TYPES[key].img}`);
        // Hata durumunda da devam et
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
          resolve();
        }
      };
      img.src = DEVICE_TYPES[key].img;
      loadedImages[key] = img;
    }
  });
}

function drawDevices(ctx) {
  devices.forEach(device => {
    const { type, x, y, ip, mac, gateway, macTable } = device;
    const icon = loadedImages[type];
    
    // Router için özel gösterim - Interface bilgileri yarısı üstte, yarısı altta
    if (type === 'router') {
      const eth0Active = ip.eth0 !== '0.0.0.0' && mac.eth0 && mac.eth0 !== '-';
      const eth1Active = ip.eth1 !== '0.0.0.0' && mac.eth1 && mac.eth1 !== '-';
      const eth2Active = ip.eth2 !== '0.0.0.0' && mac.eth2 && mac.eth2 !== '-';
      const eth3Active = ip.eth3 !== '0.0.0.0' && mac.eth3 && mac.eth3 !== '-';

      // Üstteki bilgiler (sadece aktif arayüzleri göster)
      if (eth0Active) {
        ctx.fillStyle = '#2d72d9';
        ctx.fillText('eth0 (10.0.0.0/24)', x, y-120);
        ctx.fillStyle = '#444';
        ctx.fillText(`IP: ${ip.eth0}`, x, y-105);
        ctx.fillText(`MAC: ${mac.eth0}`, x, y-90);
      }

      if (eth1Active) {
        ctx.fillStyle = '#2d72d9';
        ctx.fillText('eth1 (172.16.0.0/24)', x, y-60);
        ctx.fillStyle = '#444';
        ctx.fillText(`IP: ${ip.eth1}`, x, y-45);
        ctx.fillText(`MAC: ${mac.eth1}`, x, y-30);
      }

      // İkonu çiz
      if (icon && icon.complete && icon.naturalWidth !== 0) {
        ctx.drawImage(icon, x-32, y-32, 64, 64);
      } else {
        // Yedek harf
        ctx.fillStyle = '#eee';
        ctx.beginPath();
        ctx.arc(x, y, 32, 0, 2*Math.PI);
        ctx.fill();
        ctx.fillStyle = '#888';
        ctx.font = 'bold 28px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(DEVICE_TYPES[type].label[0], x, y);
      }
      
      // Cihaz adı
      ctx.font = 'bold 15px Segoe UI';
      ctx.fillStyle = '#222';
      ctx.textAlign = 'center';
      ctx.fillText(DEVICE_TYPES[type].label, x, y+48);

      // Alttaki bilgiler (sadece aktif arayüzleri göster)
      ctx.font = '12px Segoe UI';
      if (eth2Active) {
        ctx.fillStyle = '#2d72d9';
        ctx.fillText('eth2 (192.168.1.0/24)', x, y+70);
        ctx.fillStyle = '#444';
        ctx.fillText(`IP: ${ip.eth2}`, x, y+85);
        ctx.fillText(`MAC: ${mac.eth2}`, x, y+100);
      }

      if (eth3Active) {
        ctx.fillStyle = '#2d72d9';
        ctx.fillText('eth3 (192.168.2.0/24)', x, y+130);
        ctx.fillStyle = '#444';
        ctx.fillText(`IP: ${ip.eth3}`, x, y+145);
        ctx.fillText(`MAC: ${mac.eth3}`, x, y+160);
      }
    } else {
      // Diğer cihazlar için normal gösterim
      const size = device.size || 64;
      if (icon && icon.complete && icon.naturalWidth !== 0) {
        ctx.drawImage(icon, x - size/2, y - size/2, size, size);
      } else {
        // Yedek harf
        ctx.fillStyle = '#eee';
        ctx.beginPath();
        ctx.arc(x, y, size/2, 0, 2*Math.PI);
        ctx.fill();
        ctx.fillStyle = '#888';
        ctx.font = 'bold 28px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(DEVICE_TYPES[type].label[0], x, y);
      }
      
      // Cihaz adı
      ctx.font = 'bold 15px Segoe UI';
      ctx.fillStyle = '#222';
      ctx.textAlign = 'center';
      const labelY = y + (size/2) + 16;
      ctx.fillText(device.name || DEVICE_TYPES[type].label, x, labelY);
      
      // IP/MAC/Gateway
      ctx.font = '12px Segoe UI';
      ctx.fillStyle = '#444';
      const isCompact = (device.size && device.size <= 50) || device.compact || (device.name && /^Zombie/i.test(device.name || ''));
      if (type !== 'switch' && !isCompact) {
        const infoStartY = labelY + 16;
        if (ip) {
          ctx.fillText(`IP: ${ip}`, x, infoStartY);
        }
        if (mac) {
          ctx.fillText(`MAC: ${mac}`, x, infoStartY + 16);
        }
        if (gateway) {
          ctx.fillText(`GW: ${gateway}`, x, infoStartY + 32);
        }
      }
    }

    // Overload efekti (tüm cihaz tipleri için geçerli)
    if (device.overloaded) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 42, 0, 2*Math.PI);
      ctx.fillStyle = 'rgba(231,76,60,0.35)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#e74c3c';
      ctx.stroke();
      ctx.restore();
    }
  });
}

function drawLinks(ctx) {
  ctx.strokeStyle = '#b0b0b0';
  ctx.lineWidth = 3;
  links.forEach(([a,b]) => {
    const d1 = devices.find(d => d.id === a);
    const d2 = devices.find(d => d.id === b);
    if (d1 && d2) {
      ctx.beginPath();
      ctx.moveTo(d1.x, d1.y);
      ctx.lineTo(d2.x, d2.y);
      ctx.stroke();
    }
  });
}

function rectsIntersect(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

function drawCompactInfoBox(ctx, d) {
  // Metin satırlarını hazırla
  const ipText = d.ip ? `IP: ${typeof d.ip === 'object' ? Object.values(d.ip).filter(Boolean)[0] : d.ip}` : '';
  const macText = d.mac ? `MAC: ${typeof d.mac === 'object' ? Object.values(d.mac).filter(v => v && v !== '-')[0] : d.mac}` : '';
  const gwText = typeof d.gateway === 'string' && d.gateway ? `GW: ${d.gateway}` : '';
  const lines = [ipText, macText, gwText].filter(Boolean);
  if (lines.length === 0) return;
  // Ölçümler
  ctx.save();
  ctx.font = '12px Segoe UI';
  let w = 0;
  for (const line of lines) {
    w = Math.max(w, ctx.measureText(line).width);
  }
  const padding = 6;
  const boxW = w + padding * 2;
  const lineH = 16;
  const boxH = lines.length * lineH + padding * 2;
  // Konumlandırma: cihazın sağına/soluna (id'ye göre), sığmazsa ters tarafa; dikeyde daha belirgin sapma
  const canvas = document.getElementById('networkCanvas');
  const size = d.size || 64;
  const verticalJitter = ((d.id || 0) % 4 - 1.5) * 16; // -24, -8, +8, +24
  // Zombiler için kutuyu solda tercih et, diğerleri için id'ye göre
  const isZombie = (d.name && /^Zombie/i.test(d.name || ''));
  const preferRight = isZombie ? false : ((d.id % 2) === 1);
  let bx = preferRight ? (d.x + size/2 + 12) : (d.x - size/2 - 12 - boxW);
  let by = d.y - boxH/2 + verticalJitter;
  // Kenar taşmalarına göre düzelt
  if (bx < 4) bx = d.x + size/2 + 12;
  if (bx + boxW > canvas.width - 4) bx = d.x - size/2 - 12 - boxW;
  if (by < 4) by = 4;
  if (by + boxH > canvas.height - 4) by = canvas.height - 4 - boxH;
  // Çakışma önleme: mevcut kutularla kontrol et ve dikeyde kaydır
  const step = 18;
  let guard = 0;
  let candidate = { x: bx, y: by, w: boxW, h: boxH };
  let bumpedDown = true;
  while (drawnInfoBoxes.some(b => rectsIntersect(candidate, b)) && guard < 80) {
    // Sırayla aşağı ve yukarı kaydır
    const delta = ((guard % 2) === 0 ? step : -step) * Math.ceil((guard + 1) / 2);
    candidate.y = by + delta;
    // Sınırları zorla
    if (candidate.y < 4) candidate.y = 4;
    if (candidate.y + candidate.h > canvas.height - 4) candidate.y = canvas.height - 4 - candidate.h;
    guard++;
  }
  bx = candidate.x;
  by = candidate.y;
  // Kutu
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(bx, by, boxW, boxH);
  ctx.fill();
  ctx.stroke();
  // Bağlayıcı çizgi
  ctx.beginPath();
  ctx.moveTo(d.x + (bx > d.x ? size/2 : -size/2), d.y);
  ctx.lineTo(bx + (bx > d.x ? 0 : boxW), by + boxH/2);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Metin
  ctx.fillStyle = '#333';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], bx + padding, by + padding + 10 + i * lineH);
  }
  ctx.restore();
  // Kutuyu yerleşmiş olarak kaydet
  drawnInfoBoxes.push({ x: bx, y: by, w: boxW, h: boxH });
}

function drawTooltip(ctx) {
  if (!hoveredDevice) return;
  // Router üzerinde hover edildiğinde tooltip göstermeyelim
  if (hoveredDevice.type === 'router') return;
  const d = hoveredDevice;
  const size = d.size || 64;
  const lines = [];
  const title = d.name || DEVICE_TYPES[d.type]?.label || d.type;
  lines.push(title);
  if (d.ip) lines.push(`IP: ${typeof d.ip === 'object' ? Object.values(d.ip).filter(Boolean)[0] : d.ip}`);
  if (d.mac) lines.push(`MAC: ${typeof d.mac === 'object' ? Object.values(d.mac).filter(v => v && v !== '-')[0] : d.mac}`);
  if (d.gateway && typeof d.gateway === 'string') lines.push(`GW: ${d.gateway}`);
  // Ölçümleri al
  ctx.font = '13px Segoe UI';
  let w = 0;
  for (const line of lines) {
    w = Math.max(w, ctx.measureText(line).width);
  }
  const padding = 10;
  const lineH = 18;
  const boxW = Math.ceil(w + padding * 2);
  const boxH = Math.ceil(lines.length * lineH + padding * 2);
  // Konum: cihazın tam ÜSTÜ (yatay merkezli). Yukarı sığmazsa ALTINA kaydır.
  const canvas = document.getElementById('networkCanvas');
  const margin = 10;
  let bx = Math.round(d.x - boxW / 2);
  let by = Math.round(d.y - size/2 - margin - boxH);
  // Üste sığmazsa altına kaydır
  let placedAbove = true;
  if (by < 6) {
    by = Math.round(d.y + size/2 + margin);
    placedAbove = false;
  }
  // Yatay sınır düzeltmeleri
  if (bx < 6) bx = 6;
  if (bx + boxW > canvas.width - 6) bx = canvas.width - 6 - boxW;
  if (by + boxH > canvas.height - 6) by = canvas.height - 6 - boxH;
  // Kutu
  ctx.save();
  ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(bx, by, boxW, boxH);
  ctx.fill();
  ctx.stroke();
  // Bağlayıcı çizgi
  ctx.beginPath();
  ctx.moveTo(d.x, placedAbove ? (d.y - size/2) : (d.y + size/2));
  ctx.lineTo(bx + boxW / 2, placedAbove ? (by + boxH) : by);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Metin
  ctx.fillStyle = '#fff';
  ctx.font = '13px Segoe UI';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], bx + padding, by + padding + i * lineH);
  }
  ctx.restore();
}

async function renderNetwork() {
  const canvas = document.getElementById('networkCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawLinks(ctx);
  drawDevices(ctx);
  drawTooltip(ctx);
}

// Sayfa yüklendiğinde resimleri yükle ve ağı çiz
window.addEventListener('load', async () => {
  try {
    await loadImages();
    renderNetwork();
  } catch (error) {
    console.error('Error loading images:', error);
    renderNetwork(); // Hata olsa bile ağı çiz
  }
  // Hover dinleyicileri
  const canvas = document.getElementById('networkCanvas');
  function getDeviceAtPoint(px, py) {
    // Küçük cihazlar için daha küçük yarıçap
    for (let i = devices.length - 1; i >= 0; i--) {
      const d = devices[i];
      const r = (d.size ? d.size/2 : (d.type === 'router' ? 32 : 32)) + 6; // biraz tolerans
      const dx = px - d.x;
      const dy = py - d.y;
      if (dx*dx + dy*dy <= r*r) return d;
    }
    return null;
  }
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    // CSS ölçeklemeyi telafi et
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const d = getDeviceAtPoint(x, y);
    if (d !== hoveredDevice) {
      hoveredDevice = d;
      renderNetwork();
    }
  });
  canvas.addEventListener('mouseleave', () => {
    if (hoveredDevice) {
      hoveredDevice = null;
      renderNetwork();
    }
  });
});

function setTopologyDefaultAttackerLower() {
  devices.length = 0;
  links.length = 0;
  
  // Varsayılan cihazları kopyala
  DEFAULT_DEVICES.forEach(d => {
    const copy = { ...d };
    if (d.ip && typeof d.ip === 'object') copy.ip = { ...d.ip };
    if (d.mac && typeof d.mac === 'object') copy.mac = { ...d.mac };
    if (d.gateway && typeof d.gateway === 'object') copy.gateway = { ...d.gateway };
    if (d.macTable) copy.macTable = { ...d.macTable };
    
    // Switch 4'ün MAC tablosuna attacker ekle
    if (d.id === 4) {
      copy.macTable = {
        'AA:BB:CC:02': 'Port 1',   // Client 2
        'AA:BB:CC:0B': 'Port 2'    // Attacker
      };
    }
    
    devices.push(copy);
  });
  
  links.length = 0;
  DEFAULT_LINKS.forEach(([a, b]) => {
    // [3,10] bağlantısını atla (attacker-switch3)
    if ((a === 3 && b === 10) || (a === 10 && b === 3)) return;
    links.push([a, b]);
  });
  
  // Attacker'ı switch 4'e bağla
  links.push([4, 10]);
  
  renderNetwork();
}

window.renderNetwork = renderNetwork;
// Topoloji değiştiricileri dışa aktar
window.setTopologyDefault = setTopologyDefault;
window.setTopologyDoS = setTopologyDoS;
window.setTopologyDDoS = setTopologyDDoS;
window.setTopologyDefaultNoAttacker = setTopologyDefaultNoAttacker;
window.setTopologyDefaultAttackerLower = setTopologyDefaultAttackerLower;  // YENİ!