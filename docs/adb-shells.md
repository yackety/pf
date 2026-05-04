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