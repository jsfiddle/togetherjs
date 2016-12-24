chrome.browserAction.onClicked.addListener(function(tab){
    chrome.tabs.sendMessage(tab.id, 'tow_start')
})