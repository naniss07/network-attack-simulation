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
  // İç Network (10.0.0.0/24)
  { id: 1, type: 'client',    x: 200,  y: 200, 
    ip: '10.0.0.10', 
    mac: 'AA:BB:CC:01',
    gateway: '10.0.0.1'  // Default Gateway
  },
  { id: 2, type: 'client',    x: 200,  y: 400, 
    ip: '10.0.0.11', 
    mac: 'AA:BB:CC:02',
    gateway: '10.0.0.1'  // Default Gateway
  },
  { id: 3, type: 'switch',    x: 400,  y: 200, 
    mac: 'AA:BB:CC:03' 
  },
  { id: 4, type: 'switch',    x: 400,  y: 400, 
    mac: 'AA:BB:CC:04' 
  },
  { id: 5, type: 'router',    x: 600,  y: 300, 
    ip: { 
      eth0: '10.0.0.1',    // İç Network interface
      eth1: '192.168.1.1'  // DMZ Network interface
    }, 
    mac: {
      eth0: 'AA:BB:CC:05',
      eth1: 'AA:BB:CC:06'
    },
    gateway: {
      eth0: '0.0.0.0',     // Router'ın kendi interface'i
      eth1: '0.0.0.0'      // Router'ın kendi interface'i
    }
  },
  { id: 6, type: 'switch',    x: 800,  y: 200, 
    mac: 'AA:BB:CC:07' 
  },
  { id: 7, type: 'switch',    x: 800,  y: 400, 
    mac: 'AA:BB:CC:08' 
  },
  
  // DMZ Network (192.168.1.0/24)
  { id: 8, type: 'webserver', x: 1000, y: 200, 
    ip: '192.168.1.100', 
    mac: 'AA:BB:CC:09',
    gateway: '192.168.1.1'  // Default Gateway
  },
  { id: 9, type: 'dns',       x: 1000, y: 400, 
    ip: '192.168.1.53',  
    mac: 'AA:BB:CC:0A',
    gateway: '192.168.1.1'  // Default Gateway
  },
  
  // İç Network'teki Attacker
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
  [3,10], [4,10]   // Switches to attacker
];

// İkonları önceden yükle
const loadedImages = {};
let imagesLoaded = 0;
const totalImages = Object.keys(DEVICE_TYPES).length;

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
    const { type, x, y, ip, mac, gateway } = device;
    const icon = loadedImages[type];
    
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
    
    // IP/MAC/Gateway
    ctx.font = '12px Segoe UI';
    ctx.fillStyle = '#444';
    
    // Router için özel gösterim
    if (type === 'router') {
      // eth0 (İç Network)
      ctx.fillStyle = '#2d72d9';  // Mavi renk
      ctx.fillText('eth0 (Internal):', x, y+70);
      ctx.fillStyle = '#444';
      ctx.fillText(`IP: ${ip.eth0}`, x, y+85);
      ctx.fillText(`MAC: ${mac.eth0}`, x, y+100);
      
      // eth1 (DMZ Network)
      ctx.fillStyle = '#2d72d9';  // Mavi renk
      ctx.fillText('eth1 (DMZ):', x, y+130);
      ctx.fillStyle = '#444';
      ctx.fillText(`IP: ${ip.eth1}`, x, y+145);
      ctx.fillText(`MAC: ${mac.eth1}`, x, y+160);
    } else {
      // Diğer cihazlar için normal gösterim
      if (ip) {
        ctx.fillText(`IP: ${ip}`, x, y+64);
      }
      if (mac) {
        ctx.fillText(`MAC: ${mac}`, x, y+80);
      }
      if (gateway) {
        ctx.fillText(`GW: ${gateway}`, x, y+96);
      }
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

async function renderNetwork() {
  const canvas = document.getElementById('networkCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawLinks(ctx);
  drawDevices(ctx);
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
});

window.renderNetwork = renderNetwork; 