var baseUrl;
var blobUrls = {};

function resize(event) {
    if (window.history.state != 'select') {
        return;
    }
    var vpWidth = document.documentElement.clientWidth;
    var fontSize = parseFloat(getComputedStyle(document.body).fontSize);
    var itemWidth = document.getElementById("itemTd1").getBoundingClientRect().width;
    var gap = 0.2*fontSize;
    var margin = fontSize;
    var numItemsFitInVP = Math.floor((vpWidth - margin - itemWidth) / (itemWidth + gap)) + 1;
    var algsPerRow = Math.min(numItemsFitInVP, maxAlgsPerRow);
    maxWidth = algsPerRow * (itemWidth + gap) - gap + 0.04;
    document.getElementById('selectionLayout').style.width = maxWidth + "px";

    var right = (vpWidth - maxWidth) / 2;
    var marginTop = parseFloat(getComputedStyle(document.getElementById('selectionLayout')).marginTop);
    var modeButtonsWidth = document.getElementById('modeButtons').offsetWidth;

    if (right > modeButtonsWidth * 1.5) {
        document.getElementById('settingsButton').style.transform = "translateX(calc(100% + " + marginTop + "px))";
        document.getElementById("modeButtons").style.transform = "translateX(calc(100% + " + marginTop + "px))";
    } else {
        document.getElementById('settingsButton').style.transform = "unset";
        document.getElementById("modeButtons").style.transform = "unset";
    }
    document.getElementById('modeButtons').style.right = right + 'px';
}

function main() {
    loadSettings();
    applySettings();
    timer = document.getElementById('timer');
    timer.innerHTML = "ready";
    document.getElementById("trainerTitle").innerHTML = trainerTitle + ' | <a href="../index.html">Back</a>';
    var splitUrl = window.location.href.split('?');
    baseUrl = splitUrl[0];
    var startState = splitUrl.length > 1 ? splitUrl[1] : 'select';

    window.addEventListener('popstate', (event) => {
        showMode(history.state);
    })

    /// handles keypup and keydown events. Starts timer etc.
    document.getElementById("bodyid").addEventListener("keydown", function (event) {
        if (dialogOpen) {
            if (event.code == "Escape") {
                dialogOpen = false;
                window.allowStartingTimer = true;
            }
            if (event.code == "ArrowLeft") {
                previousCase();
            } else if (event.code == 'ArrowRight') {
                nextCase();
            }
            return;
        }
        // delete hotkey - remove last
        if (event.code == "Delete" && !running && window.history.state != "select") {
            if (!!event.shiftKey)
                confirmClear();
            else
                confirmRemLast();
            return;
        }

        if (event.code == "KeyR" && !running && window.history.state != "select") {
            confirmUnsel(lastCase);
        }

        if (event.code == "KeyB" && !running && window.history.state != "select") {
            var bookmarkButton = document.getElementById('bookmarkButton');
            bookmarkButton.click();
            bookmarkButton.blur();
        }

        if (event.code == "KeyX" && !running & window.history.state != "select") {
            if (window.history.state == "recap") {
                if (window.confirm("Are you sure you want to switch to train? This will reset your current recap progress")) {
                    changeMode("train");
                }
            } else {
                changeMode("recap");
            }
        }


        if (event.target.tagName == "INPUT") {
            return;
        }

        if (event.code == "KeyH" && !running && window.history.state != "select") {
            if (event.target.id != "hintWindow" && dialogOpenId != "hintWindow" && !dialogOpen) {
                if (event.shiftKey) {
                    document.getElementById("showHintcurrentCaseButton").click();
                } else {
                    showHint(null, window.currentCase);
                }
            }
        }

        if (!allowed || !window.allowStartingTimer)
            return; // preventing auto-repeat and empty scrambles
        if (event.code != "ShiftLeft") // shift
            allowed = false;

        if (running) {
            // stop timer on any button
            timerStop();
            return;
        }
        else if (event.code == "Space") {
            timerSetReady();
            return;
        }
    });

    /// keyup event for starting the timer
    document.getElementById("bodyid").addEventListener("keyup", function (event) {
        allowed = true;
        if (!window.allowStartingTimer)
            return; // preventing auto-repeat
        if (!running && !waiting && (event.code == "Space")) {
            timerStart();
        }
        else {
            timerAfterStop();
        }
    });

    timerDiv = document.getElementById("timerDiv")
    timerDiv.addEventListener("pointerdown", handleTouchStart, false);
    timerDiv.addEventListener("pointerup", handleTouchEnd, false);
    timerDiv.addEventListener("pointermove", (event) => {event.preventDefault();}, false);
    timerDiv.addEventListener("pointercancel", (event) => {event.preventDefault();}, false);
    window.addEventListener('keydown', function (e) {
        if (e.code == 'Space' && (e.target == document.body || e.target.tagName == "DIALOG")) {
            e.preventDefault();
        }
    });

    window.addEventListener('resize', resize);

    loadSelection();
    loadAlgs();
    displayStats();
    window.history.replaceState('select', '', "?select")
    document.getElementById('bodyid').style.display = "flex";
    if (startState != "select" && startState != "") {
        changeMode(startState);
    } else {
        showMode('select');
    }
    // document.body.style.display = "unset !important";
}

function fetchAll(...resources) {
    var destination = []
    resources.forEach(it => {
        destination.push(fetch(it).then((response) => response.json()))
    })
    return Promise.all(destination)
}

fetchAll("selected_algsets.json", "groups_info.json", "algsets_info.json", "algs_info.json", "scrambles.json", "combined.json")
    .then(
        (dicts) => {
            window.selectedAlgSets = dicts[0];
            window.algsGroups = dicts[1];
            window.algsets = dicts[2];
            window.algsInfo = dicts[3];
            window.scramblesMap = dicts[4];
            combined = dicts[5];
            
            Object.assign(selectionPresets['Default']['selCases'], selCases);
            Object.assign(selectionPresets['Default']['selectedAlgSets'], window.selectedAlgSets);
            loadSettings();
            Object.entries(combined).map((entry) => {
                if (k in blobUrls) {
                    return;
                }
                var k = entry[0];
                var svg = entry[1];
                for (const [key, value] of Object.entries(defaultSettings['cubecolors'])) {
                    svg = svg.replaceAll(value, `cc-${key}`)
                }
                for (const [key, value] of Object.entries(currentSettings['cubecolors'])) {
                    svg = svg.replaceAll(`cc-${key}`, value)

                }
                const blob = new Blob([svg], {type: 'image/svg+xml'});
                const url = URL.createObjectURL(blob);
                blobUrls[k] = url;
                }
            )
        }
    ).then((_) => {
        fetch("../template.html")
        .then((response) => response.text())
        .then((bodyHTML) => {
            applySettings();
            document.body.outerHTML = bodyHTML;
            window.requestAnimationFrame(() => {window.requestAnimationFrame(main)})
        });
    }
)