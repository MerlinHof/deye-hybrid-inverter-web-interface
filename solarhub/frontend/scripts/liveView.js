import DOM from "./dom.js";
import { getLiveData, getPeakValues, getWifiNetworks, predictBatteryRemainingTime, updateWifi } from "./com.js";
import { constants } from "./helper.js";
import StateBar from "./stateBar.js";

// Variables
const liveContainer = DOM.create("div.sideContainer#liveContainer");
const timeTextView = DOM.create("t#time");
const dateTextView = DOM.create("t#date");
const sunPowerBar = new StateBar();
const loadPowerBar = new StateBar();
const batterySocBar = new StateBar();
const gridPowerBar = new StateBar();

export async function build(mainContainer) {
   liveContainer.appendTo(mainContainer);
   buildSettingsButton();

   DOM.create("div#dateTimeContainer").append(timeTextView).append(dateTextView).appendTo(liveContainer);
   DOM.create("div#liveBadgeBox").append(DOM.create("div")).append(DOM.create("t").setText("LIVE")).appendTo(liveContainer);

   sunPowerBar.setIcon("sun.png");
   sunPowerBar.setColor({ r: 255, g: 199, b: 0 });
   sunPowerBar.setUnit("Watt");
   sunPowerBar.container.appendTo(liveContainer);

   loadPowerBar.setIcon("house.png");
   loadPowerBar.setColor({ r: 96, g: 183, b: 255 });
   loadPowerBar.setUnit("Watt");
   loadPowerBar.container.appendTo(liveContainer);

   batterySocBar.setIcon("battery.png");
   batterySocBar.setColor({ r: 0, g: 210, b: 140 });
   batterySocBar.setUnit("%");
   batterySocBar.setMax(100);
   batterySocBar.addMarker(100 * constants.battery.discharge.limit);
   batterySocBar.addMarker(100 * constants.battery.charge.limit);
   batterySocBar.container.appendTo(liveContainer);

   gridPowerBar.setUnit("Watt");
   gridPowerBar.container.appendTo(liveContainer);

   updateLiveData();
   setInterval(updateLiveData, 500);
   updateMaxValues();
   setInterval(updateMaxValues, 60 * 1000);
}

// Update Live Data & Time every Second
function updateLiveData() {
   getLiveData().then((data) => {
      if (!data) return;
      const serverTime = new Date(data.timestamp);
      const hours = String(serverTime.getHours()).padStart(2, "0");
      const minutes = String(serverTime.getMinutes()).padStart(2, "0");
      const day = String(serverTime.getDate()).padStart(2, "0");
      const month = serverTime.toLocaleString("default", { month: "long" });
      const year = serverTime.getFullYear();
      timeTextView.setText(`${hours}:${minutes}`);
      dateTextView.setText(`${day}. ${month} ${year}`);

      sunPowerBar.setValue(data.p_sun);
      loadPowerBar.setValue(data.p_load);
      batterySocBar.setValue(data.batt_soc);

      if (data.batt_soc >= 100 * constants.battery.charge.limit) {
         batterySocBar.setInfoText("Batterie voll");
      } else if (data.batt_soc <= 100 * constants.battery.discharge.limit) {
         batterySocBar.setInfoText("Batterie leer");
      } else {
         const power = -data.p_batt;
         const powerString = (power > 0 ? "+" : "") + power.toLocaleString("de-DE");
         predictBatteryRemainingTime(data.batt_soc).then((prediction) => {
            if (Math.abs(prediction.averagePower) <= 15) {
               batterySocBar.setInfoText(`${powerString} Watt`);
               return;
            }
            const timePredString = `${prediction.hours}:${prediction.minutes.toString().padStart(2, "0")} Std. bis ${prediction.charging ? "voll" : "leer"}`;
            batterySocBar.setInfoText(`${powerString} Watt ➜ ${timePredString}`);
         });
      }
      gridPowerBar.setValue(Math.abs(data.p_grid));
      if (data.p_grid <= 0) {
         gridPowerBar.setIcon("grid_export.png");
         gridPowerBar.setColor({ r: 0, g: 176, b: 155 });
         gridPowerBar.setInfoText(`+${constants.earningsPerKwh.toEuroString()} / kWh`);
      } else {
         gridPowerBar.setIcon("grid_import.png");
         gridPowerBar.setColor({ r: 255, g: 44, b: 133 });
         gridPowerBar.setInfoText(`-${constants.costPerKwh.toEuroString()} / kWh`);
      }
   });
}

// Update all Values that don't need to be updated every second.
function updateMaxValues() {
   const end = Date.now();
   const start = end - 7 * 24 * 60 * 60 * 1000;
   let maxSunPower, maxLoadPower;
   getPeakValues("p_sun", start, end).then((res) => {
      maxSunPower = Math.round(res.val);
      sunPowerBar.setInfoText(`Max. ${maxSunPower.toLocaleString("de-DE")} Watt`);
   });
   getPeakValues("p_load", start, end).then((res) => {
      maxLoadPower = Math.round(res.val);
      loadPowerBar.setInfoText(`Max. ${maxLoadPower.toLocaleString("de-DE")} Watt`);
   });
   const interval = setInterval(() => {
      if (!maxSunPower || !maxLoadPower) return;
      clearInterval(interval);
      const peakPower = Math.max(maxSunPower, maxLoadPower);
      sunPowerBar.setMax(peakPower);
      loadPowerBar.setMax(peakPower);
      gridPowerBar.setMax(peakPower);
   }, 50);
}

// Builds the Settings button
function buildSettingsButton() {
   DOM.create("div#settingsButton")
      .appendTo(liveContainer)
      .onClick(async () => {
         let networks;
         getWifiNetworks().then((res) => {
            networks = res;
         });
         let confirmed = confirm("Möchtest Du eine neue WLAN-Verbindung einrichten?");
         if (!confirmed) return;

         // Wait Until Networks are fetched.
         while (!networks) await new Promise((resolve) => setTimeout(resolve, 10));

         let networksString = "";
         for (let i = 0; i < networks.length; i++) {
            const network = networks[i];
            networksString += `\n${i + 1}. ${network["SSID"]} (${network["RATE"]} Mbit/s, ${network["SIGNAL"]}%)`;
         }
         const ssidIndex = prompt(`Verfügbare Netwerke:${networksString}\n\nIndex der SSID des neuen Netzwerks eingeben (z.B. 3):`);
         if (ssidIndex === null) return;
         const ssid = networks[parseInt(ssidIndex) - 1]["SSID"];
         const password = prompt(`Passwort für ${ssid} eingeben:`);
         if (password === null) return;
         const staticIp = prompt(`Optional: Statische IP-Adresse festlegen (z.B. 192.168.31.7):`);
         let userConfirmed = confirm(
            `Sicher, dass das Netzwerk zu ${ssid} (PW: ${password}, IP: ${staticIp || "Dynamisch"}) geändert werden soll? Das bisherige Netzwerk funktioniert dann nicht mehr.`,
         );
         if (userConfirmed) {
            updateWifi(ssid, password, staticIp).then((res) => {
               window.alert("System wird neu gestartet und ist danach unter seiner neuen IP erreichbar.");
            });
         } else {
            window.alert("Abgebrochen. Altes Netzwerk wird beibehalten.");
         }
      });
}
