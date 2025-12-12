// Map initialization
const map = L.map('map').setView([23.5, 121], 7); // Default to Taiwan center

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let userMarker = null;
let cooldownCircle = null;
let startTime = null;
let timerInterval = null;
let userLat = null;
let userLng = null;

// Cooldown Data (Distance in KM, Time in Seconds)
// Data points from user's request
const cooldownData = [
    { km: 0, time: 0 },
    { km: 1, time: 30 },
    { km: 5, time: 120 }, // 2m
    { km: 10, time: 420 }, // 7m
    { km: 12, time: 480 }, // 8m
    { km: 18, time: 600 }, // 10m
    { km: 26, time: 900 }, // 15m
    { km: 42, time: 1140 }, // 19m
    { km: 65, time: 1320 }, // 22m
    { km: 81, time: 1500 }, // 25m
    { km: 100, time: 2100 }, // 35m
    { km: 250, time: 2700 }, // 45m
    { km: 375, time: 3240 }, // 54m
    { km: 460, time: 3720 }, // 62m
    { km: 565, time: 4140 }, // 69m
    { km: 700, time: 4680 }, // 78m
    { km: 800, time: 5040 }, // 84m
    { km: 900, time: 5520 }, // 92m
    { km: 1000, time: 5940 }, // 99m
    { km: 1300, time: 7020 }, // 117m
    { km: 1500, time: 7200 }  // 120m (2h)
];

const locateBtn = document.getElementById('locate-btn');
const startBtn = document.getElementById('start-btn');
const statusDiv = document.getElementById('status');
const timerDiv = document.getElementById('timer');
const radiusInfoDiv = document.getElementById('radius-info');

// Helper to format time
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Helper to calculate radius based on elapsed time (Linear Interpolation)
function getRadiusForTime(elapsedSeconds) {
    if (elapsedSeconds <= 0) return 0;
    
    // Find the interval we are in
    for (let i = 0; i < cooldownData.length - 1; i++) {
        const p1 = cooldownData[i];
        const p2 = cooldownData[i + 1];
        
        if (elapsedSeconds >= p1.time && elapsedSeconds <= p2.time) {
            // Linear interpolation
            const ratio = (elapsedSeconds - p1.time) / (p2.time - p1.time);
            return p1.km + ratio * (p2.km - p1.km);
        }
    }
    
    // If beyond the last point (1500km / 2 hours), extrapolate or cap?
    // User data shows >1500km is 2 hours, implying max cooldown is 2 hours.
    // However, usually in these games, once you wait 2 hours you can go anywhere.
    // So distinct behavior: if > 2 hours, radius could be considered infinite or we just show max.
    // Let's cap at 1500km+ logic or just keep expanding linearly based on the last speed? 
    // Actually typically "cooldown" means after 2 hours you can catch anything anywhere.
    // So the circle should probably encompass the whole world or just stop expanding visually if it covers everything relevant.
    // But physically, let's just return 1500 for anything > 7200s or maybe extremely large.
    if (elapsedSeconds > 7200) {
        return 20000; // Earth circumference basically, cleared cooldown
    }
    return 0;
}

// Geolocation
locateBtn.addEventListener('click', () => {
    statusDiv.textContent = "正在定位...";
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            userLat = position.coords.latitude;
            userLng = position.coords.longitude;
            
            if (userMarker) map.removeLayer(userMarker);
            
            userMarker = L.marker([userLat, userLng]).addTo(map)
                .bindPopup("你的位置").openPopup();
                
            map.setView([userLat, userLng], 13);
            statusDiv.textContent = "已定位！請按下開始。";
            startBtn.disabled = false;
        }, (error) => {
            statusDiv.textContent = "定位失敗: " + error.message;
            console.error(error);
        });
    } else {
        statusDiv.textContent = "您的瀏覽器不支援定位功能。";
    }
});

// Start Timer
startBtn.addEventListener('click', () => {
    if (userLat === null || userLng === null) {
        alert("請先定位！");
        return;
    }

    // Reset
    if (cooldownCircle) map.removeLayer(cooldownCircle);
    if (timerInterval) clearInterval(timerInterval);
    
    startTime = Date.now();
    statusDiv.textContent = "冷卻計時中...";
    startBtn.textContent = "重新開始";
    
    // Initial circle
    cooldownCircle = L.circle([userLat, userLng], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.2,
        radius: 0
    }).addTo(map);

    timerInterval = setInterval(() => {
        const now = Date.now();
        const elapsedSeconds = (now - startTime) / 1000;
        
        // Update Timer UI
        timerDiv.textContent = formatTime(elapsedSeconds);
        
        // Calculate Radius
        const currentRadiusKm = getRadiusForTime(elapsedSeconds);
        const currentRadiusMeters = currentRadiusKm * 1000;
        
        // Update Circle
        cooldownCircle.setRadius(currentRadiusMeters);
        
        // Update Radius UI
        if (currentRadiusKm >= 20000) {
             radiusInfoDiv.textContent = "冷卻完成 (任意距離)";
             cooldownCircle.setStyle({ color: 'green', fillColor: '#3f0' });
        } else {
             radiusInfoDiv.textContent = `半徑: ${currentRadiusKm.toFixed(2)} 公里`;
        }
        
    }, 100); // Update every 100ms for smoothness
});
