/**
 * 高德天气 API 集成
 * 使用高德天气 API 获取实时天气信息
 */

(function() {
  'use strict';

  // 高德 API Key
  const AMAP_KEY = '381f905c40bb943cf975a737dc7a81b4';
  
  // 天气数据缓存（30分钟）
  const CACHE_KEY = 'hexo_weather_data';
  const CACHE_TIME = 30 * 60 * 1000; // 30分钟

  // 获取用户位置（使用 IP 定位）
  function getLocation() {
    return new Promise((resolve, reject) => {
      // 优先使用缓存的位置
      const cachedLocation = localStorage.getItem('hexo_weather_location');
      if (cachedLocation) {
        try {
          const location = JSON.parse(cachedLocation);
          resolve(location);
          return;
        } catch (e) {
          console.error('解析缓存位置失败:', e);
        }
      }

      // 使用高德 IP 定位 API - JSONP 方式
      const ipUrl = `https://restapi.amap.com/v3/ip?key=${AMAP_KEY}`;
      const callbackName = 'amapIpCallback_' + Date.now();
      const script = document.createElement('script');
      
      window[callbackName] = function(data) {
        // 清理
        document.body.removeChild(script);
        delete window[callbackName];
        
        if (data.status === '1' && data.city) {
          // 获取城市编码
          const cityCodeUrl = `https://restapi.amap.com/v3/config/district?key=${AMAP_KEY}&keywords=${encodeURIComponent(data.city)}&subdistrict=0&extensions=base`;
          const cityCallbackName = 'amapCityCallback_' + Date.now();
          const cityScript = document.createElement('script');
          
          window[cityCallbackName] = function(cityData) {
            document.body.removeChild(cityScript);
            delete window[cityCallbackName];
            
            if (cityData.status === '1' && cityData.districts && cityData.districts.length > 0) {
              const adcode = cityData.districts[0].adcode;
              const location = {
                city: data.city,
                adcode: adcode
              };
              localStorage.setItem('hexo_weather_location', JSON.stringify(location));
              resolve(location);
            } else {
              resolve({ city: '北京', adcode: '110000' });
            }
          };
          
          cityScript.src = cityCodeUrl + '&callback=' + cityCallbackName;
          cityScript.onerror = function() {
            document.body.removeChild(cityScript);
            delete window[cityCallbackName];
            resolve({ city: '北京', adcode: '110000' });
          };
          document.body.appendChild(cityScript);
        } else {
          resolve({ city: '北京', adcode: '110000' });
        }
      };
      
      script.src = ipUrl + '&callback=' + callbackName;
      script.onerror = function() {
        document.body.removeChild(script);
        delete window[callbackName];
        resolve({ city: '北京', adcode: '110000' });
      };
      document.body.appendChild(script);
    });
  }

  // 获取天气信息
  function getWeather(location) {
    return new Promise((resolve, reject) => {
      // 检查缓存
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          const now = Date.now();
          if (now - data.timestamp < CACHE_TIME && data.location.adcode === location.adcode) {
            resolve(data.weather);
            return;
          }
        } catch (e) {
          console.error('解析缓存失败:', e);
        }
      }

      // 调用高德天气 API - 使用 base 获取实时天气
      const weatherUrl = `https://restapi.amap.com/v3/weather/weatherInfo?key=${AMAP_KEY}&city=${location.adcode}&extensions=base`;
      
      // 使用 JSONP 方式调用，避免跨域问题
      const callbackName = 'amapWeatherCallback_' + Date.now();
      const script = document.createElement('script');
      
      window[callbackName] = function(data) {
        // 清理
        document.body.removeChild(script);
        delete window[callbackName];
        
        if (data.status === '1' && data.lives && data.lives.length > 0) {
          const live = data.lives[0];
          
          const weatherData = {
            location: location.city,
            temp: live.temperature || '--',
            weather: live.weather || '--',
            windpower: live.windpower || '--',
            winddir: live.winddirection || '--',
            humidity: live.humidity ? live.humidity + '%' : '--',
            updateTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
          };

          // 保存到缓存
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            location: location,
            weather: weatherData
          }));

          resolve(weatherData);
        } else {
          reject(new Error('获取天气数据失败'));
        }
      };
      
      script.src = weatherUrl + '&callback=' + callbackName;
      script.onerror = function() {
        document.body.removeChild(script);
        delete window[callbackName];
        reject(new Error('网络请求失败'));
      };
      document.body.appendChild(script);
    });
  }

  // 更新天气显示
  function updateWeatherDisplay(weatherData) {
    const loadingEl = document.querySelector('.weather-loading');
    const mainEl = document.querySelector('.weather-main');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (mainEl) {
      mainEl.style.display = 'block';
      
      const locationEl = document.getElementById('weather-location');
      const tempEl = document.getElementById('weather-temp');
      const weatherEl = document.getElementById('weather-weather');
      const windpowerEl = document.getElementById('weather-windpower');
      const humidityEl = document.getElementById('weather-humidity');
      const winddirEl = document.getElementById('weather-winddir');
      const updateTimeEl = document.getElementById('weather-update-time');
      
      if (locationEl) locationEl.textContent = weatherData.location || '未知';
      if (tempEl) tempEl.textContent = weatherData.temp || '--';
      if (weatherEl) weatherEl.textContent = weatherData.weather || '--';
      if (windpowerEl) windpowerEl.textContent = weatherData.windpower ? weatherData.windpower + '级' : '--';
      if (humidityEl) humidityEl.textContent = weatherData.humidity || '--';
      if (winddirEl) winddirEl.textContent = weatherData.winddir || '--';
      if (updateTimeEl) updateTimeEl.textContent = weatherData.updateTime || '--';
    }
  }

  // 显示错误信息
  function showError(message) {
    const loadingEl = document.querySelector('.weather-loading');
    if (loadingEl) {
      loadingEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>${message || '加载失败'}</span>`;
    }
  }

  // 初始化天气组件
  function initWeather() {
    const weatherCard = document.querySelector('.card-weather');
    if (!weatherCard) return;

    getLocation()
      .then(location => {
        return getWeather(location);
      })
      .then(weatherData => {
        updateWeatherDisplay(weatherData);
      })
      .catch(error => {
        console.error('天气初始化失败:', error);
        showError('获取天气信息失败，请稍后重试');
      });
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeather);
  } else {
    initWeather();
  }

  // 支持 PJAX 重新加载
  if (typeof btf !== 'undefined') {
    btf.addGlobalFn('pjaxComplete', initWeather, 'weather_init');
  }

})();

