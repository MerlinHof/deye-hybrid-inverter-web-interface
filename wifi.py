### ChatGPT (4o) was a helping A LOT creating this file ;)

import os
import subprocess
import time

AP_SSID = "PVSchulz AP"
AP_PASSWORD = "12341234"
STARTUP_DELAY = 120 # Sekunden
CHECK_INTERVAL = 30 # Sekunden
AP_TIME = 20*60 # Sekunden
WIFI_TIME = 120 # Sekunden
PING_ATTEMPTS = 5

def startWatchdog():
   time.sleep(STARTUP_DELAY)
   while True:
      time.sleep(CHECK_INTERVAL)
      if isConnectedToWifi():
         print("Connected to Wifi, no AP.")
      else:
         print("Not Connected to Wifi, starting AP...")
         startAP()
         time.sleep(AP_TIME)
         stopAP()
         time.sleep(WIFI_TIME)

def isConnectedToWifi(host="8.8.8.8"):
   for attempt in range(PING_ATTEMPTS):
      try:
         response = subprocess.run(
            ["ping", "-c", "1", "-W", "2", host],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
         )
         if response.returncode == 0:
            return True
      except Exception as e:
         print(f"Fehler bei der Ausführung der Ping-Anfrage (Versuch {attempt + 1}): {e}")
   return False

def startAP():
   try:
      # Stoppe den NetworkManager vor dem Start des AP
      subprocess.run("sudo systemctl stop NetworkManager", shell=True, check=True)

      # Stoppe den Service, wenn er bereits läuft
      subprocess.run("sudo systemctl stop hostapd", shell=True, check=True)
      subprocess.run("sudo systemctl stop dnsmasq", shell=True, check=True)

      # Erstelle virtuelles Interface, wenn es nicht existiert
      result = subprocess.run("iw dev | grep uap0", shell=True, stdout=subprocess.PIPE)
      if result.returncode != 0:
         subprocess.run("sudo iw dev wlan0 interface add uap0 type __ap", shell=True, check=True)

      # Konfiguriere das virtuelle Interface uap0
      subprocess.run("sudo ifconfig uap0 192.168.4.1/24 up", shell=True, check=True)

      # Konfiguriere dnsmasq
      with open("/etc/dnsmasq.conf", "w") as file:
         file.write(
            "interface=uap0\n"
            "dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h\n"
         )

      # Konfiguriere hostapd
      with open("/etc/hostapd/hostapd.conf", "w") as file:
         file.write(
            "interface=uap0\n"
            "driver=nl80211\n"
            f"ssid={AP_SSID}\n"
            "hw_mode=g\n"
            "channel=7\n"
            "wmm_enabled=0\n"
            "macaddr_acl=0\n"
            "auth_algs=1\n"
            "ignore_broadcast_ssid=0\n"
            "wpa=2\n"
            f"wpa_passphrase={AP_PASSWORD}\n"
            "wpa_key_mgmt=WPA-PSK\n"
            "wpa_pairwise=TKIP\n"
            "rsn_pairwise=CCMP\n"
         )

      # Weise hostapd an, die Konfigurationsdatei zu verwenden
      with open("/etc/default/hostapd", "w") as file:
         file.write("DAEMON_CONF=\"/etc/hostapd/hostapd.conf\"\n")

      # Starte die Dienste neu
      subprocess.run("sudo systemctl unmask hostapd", shell=True, check=True)
      subprocess.run("sudo systemctl unmask dnsmasq", shell=True, check=True)
      subprocess.run("sudo systemctl start hostapd", shell=True, check=True)
      subprocess.run("sudo systemctl start dnsmasq", shell=True, check=True)
      print("AP gestartet")

   except subprocess.CalledProcessError as e:
      print(f"Fehler beim Starten des AP: {e}")

def stopAP():
   try:
      # Stoppe den Service, wenn er läuft
      subprocess.run("sudo systemctl stop hostapd", shell=True, check=True)
      subprocess.run("sudo systemctl stop dnsmasq", shell=True, check=True)
      time.sleep(5)

      # Starte den NetworkManager neu, um die Verbindung zu bekannten Netzwerken wiederherzustellen
      subprocess.run("sudo systemctl start NetworkManager", shell=True, check=True)
      time.sleep(5)

      # wlan0 interface neu starten
      subprocess.run("sudo ifconfig wlan0 down", shell=True, check=True)
      time.sleep(5)
      subprocess.run("sudo ifconfig wlan0 up", shell=True, check=True)
      print("AP gestoppt")

   except subprocess.CalledProcessError as e:
      print(f"Fehler beim Stoppen des AP: {e}")


def connectNewNetwork(ssid, password):
   # Lösche vorherige Verbindungen, die mit dem SSID übereinstimmen
   connections = subprocess.run(['nmcli', '-t', '-f', 'NAME,UUID', 'connection', 'show'], capture_output=True, text=True).stdout
   for line in connections.splitlines():
      name, uuid = line.split(':')
      if name == ssid:
         subprocess.run(['nmcli', 'connection', 'delete', 'uuid', uuid])
   # Neue WLAN-Verbindung hinzufügen
   subprocess.run(['nmcli', 'device', 'wifi', 'connect', ssid, 'password', password])


# End of File
