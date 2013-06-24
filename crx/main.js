~function () {
    var towLoaded = false

    var s = document.createElement('script')
    s.id = "J_TowForChrome"
    s.src = "https://towtruck.mozillalabs.com/towtruck.js"
    s.onload = function () {
        towLoaded = true
    }
    document.head.appendChild(s)

    chrome.extension.onMessage.addListener(function (command) {
        command == 'tow_start' && createExecScript()
    })

    function createExecScript() {

        var exec = document.createElement('script')
        exec.onload = function () {
            this.parentNode.removeChild(this)
        }
        exec.text = 'TowTruckConfig_enableAnalytics = true;TowTruck()'
        if (towLoaded) {
            document.head.appendChild(exec)

        } else {
            s.onload = function () {
                towLoaded = true;
                document.head.appendChild(exec)
            }

        }
    }
}()