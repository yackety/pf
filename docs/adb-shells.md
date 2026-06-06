988a1b313954434b5930	device
ce0717174c594c8b0d7e	device
ce071717bc07e201047e	device
ce091719336098890c7e	device
ce12171c8d984a27037e	device

push file
adb -s 988a1b313954434b5930 push Telegram_12.6.4_APKPure.apk /data/local/tmp/file.apk
adb -s 988a1b313954434b5930 push 'Google Chrome_147.0.7727.137_APKPure.xapk' /data/local/tmp/chrome.xapk


adb -s B2NGAA8871301377 push 'Microsoft Edge_ Web Browser_147.0.3912.87_APKPure.apk' /data/local/tmp/edge.apk

adb -s 988a1b313954434b5930 push 'Microsoft Edge_ Web Browser_147.0.3912.87_APKPure.apk' /data/local/tmp/edge.apk

list files
adb -s 988a1b313954434b5930 shell ls /data/local/tmp/

install
adb -s 988a1b313954434b5930 shell pm install -r /data/local/tmp/chrome.xapk
adb -s B2NGAA8871301377 shell pm install -r /data/local/tmp/edge.apk
adb -s 988a1b313954434b5930 shell pm install -r /data/local/tmp/edge.apk

adb -s 988a1b313954434b5930 install-multiple chrome_extracted/chrome.apk chrome_extracted/com.android.chrome.apk chrome_extracted/config.en.apk chrome_extracted/on_demand.apk

List packages
adb -s B2NGAA8871301377 shell pm list packages

com.google.android.youtube
open an app
adb -s B2NGAA8871301377 shell am start -n com.google.android.youtube/com.google.android.youtube.app.honeycomb.Shell\$HomeActivity

Disable Auto-Rotate:
adb -s B2NGAA8871301377 shell settings put system accelerometer_rotation 0
Force Portrait Mode:
adb -s B2NGAA8871301377 shell settings put system user_rotation

-- auto script
adb -s B2NGAA8871301377 shell monkey -p com.android.chrome 1

- pointer_location
adb -s 988a1b313954434b5930 shell settings put system pointer_location 1

push and install proxy
adb -s 988a1b313954434b5930 push cmfa-2.11.27-meta-arm64-v8a-release.apk /data/local/tmp/clash.apk
adb -s 988a1b313954434b5930 shell pm install -r /data/local/tmp/clash.apk

adb -s 988a1b313954434b5930 push config.yaml /sdcard/Android/data/com.github.metacubex.clash.meta/files/config.yaml
adb -s 988a1b313954434b5930 shell am start -n com.github.metacubex.clash.meta/com.github.kr328.clash.MainActivityAlias

adb -s 988a1b313954434b5930 shell "su -c 'sqlite3 /data/data/com.codeages.proxydroid/databases/proxydroid.db \"UPDATE profiles SET host=\x2714.225.50.250\x27, port=\x2755555\x27, type=\x27HTTP\x27, auth=\x271\x27, user=\x27kkjh1q9o\x27, password=\x27vDaU9u0F\x27 WHERE _id=1;\"'"

check ip
adb -s 988a1b313954434b5930 shell am start -a android.intent.action.VIEW -d "https://ipinfo.io"

adb -s 988a1b313954434b5930 push uptodown-com.scheler.superproxy.apk /data/local/tmp/uptodown-com.scheler.superproxy.apk
adb -s 988a1b313954434b5930 shell pm install -r /data/local/tmp/uptodown-com.scheler.superproxy.apk



adb -s 988a1b313954434b5930 push Facebook_558.0.0.70.72_APKPure.apk /data/local/tmp/Facebook_558.0.0.70.72_APKPure.apk
adb -s 988a1b313954434b5930 shell pm install -r /data/local/tmp/Facebook_558.0.0.70.72_APKPure.apk

adb -s 988a1b313954434b5930 shell pm list packages | grep supper

adb -s 988a1b313954434b5930 shell pm path com.scheler.superproxy

for p in $(adb -s 988a1b313954434b5930 shell pm path com.scheler.superproxy | sed 's/package://'); do
  adb -s 988a1b313954434b5930 pull "$p" superproxy/
done

adb -s 988a1b313954434b5930 pull "/data/app/~~tEQH0bl3Oyikxh5ScN8SUw==/com.scheler.superproxy-Q4mX9ptAScVJ1qfidZQJEg==/base.apk" "supperproxy/"

adb -s 988a1b313954434b5930 pull "/data/app/~~tEQH0bl3Oyikxh5ScN8SUw==/com.scheler.superproxy-Q4mX9ptAScVJ1qfidZQJEg==/split_config.arm64_v8a.apk" "supperproxy/"

adb -s 988a1b313954434b5930 pull "/data/app/~~tEQH0bl3Oyikxh5ScN8SUw==/com.scheler.superproxy-Q4mX9ptAScVJ1qfidZQJEg==/split_config.en.apk" "supperproxy/"

adb -s 988a1b313954434b5930 pull "/data/app/~~tEQH0bl3Oyikxh5ScN8SUw==/com.scheler.superproxy-Q4mX9ptAScVJ1qfidZQJEg==/split_config.xxhdpi.apk" "supperproxy/"

adb -s ce0717174c594c8b0d7e install-multiple /data/local/tmp/supperproxy/base.apk /data/local/tmp/supperproxy/split_config.arm64_v8a.apk /data/local/tmp/supperproxy/split_config.en.apk /data/local/tmp/supperproxy/split_config.xxhdpi.apk



adb -s ce0717174c594c8b0d7e shell pm install-create
adb -s ce0717174c594c8b0d7e shell pm install-commit 892984454

adb -s ce0717174c594c8b0d7e shell pm install-write 892984454 base base.apk

adb -s ce0717174c594c8b0d7e push base.apk /data/local/tmp/supperproxy
adb -s ce0717174c594c8b0d7e push split_config.arm64_v8a.apk /data/local/tmp/supperproxy
adb -s ce0717174c594c8b0d7e push split_config.en.apk /data/local/tmp/supperproxy
adb -s ce0717174c594c8b0d7e push split_config.xxhdpi.apk /data/local/tmp/supperproxy


adb -s 988a1b313954434b5930 push college-proxy.apk /data/local/tmp/college-proxy.apk

adb -s 988a1b313954434b5930 shell pm install -r /data/local/tmp/college-proxy.apk

adb -s 988a1b313954434b5930 shell locksettings set-pin 1234


adb -s 988a1b313954434b5930 push com.facebook.katana_apkmirror.com.apk /data/local/tmp/com.facebook.katana_apkmirror.com.apk

adb -s 988a1b313954434b5930 shell pm install -r /data/local/tmp/com.facebook.katana_apkmirror.com.apk