var allowStartingTimer;
var timesArray = JSON.parse(loadLocal(timesArrayKey, "[]"));
if (timesArray == null) // todo fix when figure out why JSON.parse("[]") returns 0
    timesArray = [];
var currentScramble = "";
var hintCase = 0;
var customAlgs = {};

/// invokes generateScramble() and sets scramble string
function showScramble() {
    window.allowStartingTimer = false;
    var s;
    if (selCases.length == 0) {
        s = "click \"select cases\" above and pick some olls to practice";
        document.getElementById("selInfo").innerHTML = "";
    }
    else {
        s = generateScramble();
        window.allowStartingTimer = true;
    }
    var onclickS = `onclick='showHint(this, ${window.currentCase})'`;
    document.getElementById("scramble").innerHTML = `<span ${onclickS}> ${s} </span><span class='inlineButton' style='font-size: 1em !important;' ${onclickS}>?</span>`;
}

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function confirmUnsel(i) {
    if (confirm("Do you want to unselect case " + algsInfo[i]['name']  + "?")) {
        var caseIndex = selCases.indexOf(i);
        var displayName = getAlgName(i);
        if (caseIndex >= 0) {
            selCases.splice(caseIndex, 1);
            document.getElementById("last_scramble").firstChild.innerHTML = `Removed case ${displayName}!`;
        } else {
            selCases.push(i);
            document.getElementById("last_scramble").firstChild.innerHTML = `Re-selected case ${displayName}!`;
        }
        saveSelection();
        displayPracticeInfo();
    }
}

function bookmarkCase(i) {
    if (!selectionPresets['Bookmarks']) {
        selectionPresets['Bookmarks'] = {
            'selCases': [],
            'selectedAlgSets': {}
        };
    }
    var preset = selectionPresets['Bookmarks'];
    var presetSelcases = preset['selCases'];
    var presetAlgsets = preset['selectedAlgSets'];
    var algset = algsInfo[i]['algset'];
    var caseIndex = presetSelcases.indexOf(i);
    if (caseIndex >= 0) {
        if (!window.confirm(`Are you sure you want to remove the bookmark from ${getAlgName(i)}`)) {
            return;
        }
    }
    if (caseIndex >= 0) {
        presetSelcases.splice(caseIndex, 1);
        var algsetsInSel = {};
        for (const caseId of presetSelcases) {
            algsetsInSel[algsInfo[caseId]['algset']] = true;
        }
        preset['selectedAlgSets'] = algsetsInSel;
        document.getElementById('bookmarkButton').innerText = "bookmark_add";
        if (presetSelcases.length == 0) {
            delete selectionPresets['Bookmarks'];
        }
    } else {
        presetSelcases.push(i);
        presetAlgsets[algset] = true;
        document.getElementById('bookmarkButton').innerText = "bookmark_remove";
    }
    localStorage.setItem(selectionArrayKey + 'Presets', JSON.stringify(selectionPresets));
}

function getBookmarkButton(i) {
    if (selectionPresets['Bookmarks']) {
        var index = selectionPresets['Bookmarks']['selCases'].indexOf(i);
        if (index >= 0) {
            return `<span id='bookmarkButton' class='material-symbols-outlined inlineButton' onclick='bookmarkCase(${i})'>bookmark_remove</span>`;
        }
    }
    return `<span id='bookmarkButton' class='material-symbols-outlined inlineButton' onclick='bookmarkCase(${i})'>bookmark_add</span>`;
}

function displayPracticeInfo() {
    var caseCount = selCases.length;
    var s = "";
    if (recapArray.length == 0)
        s += "<b><a onclick='changeMode(\"recap\")'>Train</a> " + caseCount + " Cases</b>";
    else {
        s += "<b><a onclick='changeMode(\"train\")'>Recap</a> " + recapArray.length + " Cases</b>";
    }

    document.getElementById("selInfo").innerHTML = s;
}

function generateScramble() {
    if (window.currentScramble != "") {
        document.getElementById("last_scramble").innerHTML = `<span>Last scramble: ${window.currentScramble}`
        + ` <span id='showHintcurrentCaseButton' onclick='showHint(this,${window.currentCase})' class='caseNameStats'>(${getAlgName(window.currentCase)})</span></span><span id='last-scramble-buttons'>`
        + getBookmarkButton(window.currentCase)
        + `<span class='material-symbols-outlined inlineButton' onclick='confirmUnsel(${window.currentCase})'>close</span>`
        + `<span class='material-symbols-outlined inlineButton' onclick='confirmRemLast();'>undo</span></span>`;
    }
    displayPracticeInfo();
    // get random case
    var caseNum = 0;
    if (recapArray.length == 0) { // train
        if (window.history.state == 'recap') {
            window.history.replaceState('train', '', baseUrl + "?train")
        }
        if (currentSettings['weightedChoice'] || currentSettings['weightedChoiceTime']) {
            var selCasesCounts = []; // count how often each case has appeared already
            var selCasesMeans = []; // the mean of each selected case
            for (var i = 0; i < selCases.length; i++) {
                var count = 0;
                var mean = 0;
                var currentCase = selCases[i];
                for (var j = 0; j < window.timesArray.length; j++) {
                    if (window.timesArray[j]["case"] == window.currentCase) {
                        count += 1;
                        mean += window.timesArray[j]["ms"]
                    }
                }
                selCasesCounts.push(count);
                selCasesMeans.push(0.001*mean/count) // may be NaN for 0 count, dealt with later
            }

            // any unseen case will be as likely as the slowest case until timed
            const maxMean = Math.max(0, ...selCasesMeans.filter(Number.isFinite))
            selCasesMeans = selCasesMeans.map(v => Number.isFinite(v) ? v : maxMean)

            var selCaseWeights = []; // calculate the weights with which the next case is to be chosen. weights are arranged cumulatively
            for (var i = 0; i < selCasesCounts.length; i++) {
                const weight = (currentSettings['weightedChoice'] * ((selCasesCounts[i] + 0.1) ** -0.8) || 1) * (currentSettings['weightedChoiceTime'] * selCasesMeans[i] ** 0.8 || 1)
                if (i == 0)
                    selCaseWeights.push(weight);
                else
                    selCaseWeights.push(selCaseWeights[i - 1] + weight);
            }
            caseNum = weightedRandomElement(selCases, selCaseWeights)
        }

        else // random choice of next case
            caseNum = randomElement(selCases);
    } else { // recap
        // select the case
        caseNum = randomElement(recapArray);
        // remove it from the array
        const index = recapArray.indexOf(caseNum);
        recapArray.splice(index, 1);
    }
    var alg = randomElement(window.scramblesMap[caseNum]);
    var preMove = randomElement(preMoves);
    if (preMove != "") preMove += " ";
    var postMove = randomElement(postMoves);
    if (postMove != "") postMove = " " + postMove;
    var preRotation = randomElement(preRotations);
    if (preRotation != "") preRotation += " ";
    var postRotation = randomElement(postRotations);
    if (postRotation != "") postRotation += " ";

    var finalAlg = preRotation + preMove + alg + postMove + postRotation;
    if (trainerTitle.includes("Square-1")) {
        var flipSlice = Math.random() > 0.5;
        var parts = alg.split("/");
        var slice_flipped = parts.length % 2 == 0;
        if (trainerTitle.includes("OBL") && flipSlice) {
            console.log("x2 done")
            var second = parts.at(1);
            var slu = parseInt(second.split(",")[0]);
            var sld = parseInt(second.split(",")[1]);
            slu += 6
            sld += 6
            if (slu > 6) {
                slu -= 12;
            }
            if (sld > 6) {
                sld -= 12;
            }
            parts[1] = ` ${slu},${sld} `
        } else if (flipSlice != slice_flipped) {
            var secondLast = parts.at(-2);
            var slu = parseInt(secondLast.split(",")[0]);
            var sld = secondLast.split(",")[1];
            slu += 6
            if (slu > 6) {
                slu -= 12;
            }
            parts[parts.length - 2] = ` ${slu},${sld} `
            parts.splice(parts.length - 1, 0, " 6,0 ")
        }
        var firstMoveParts = parts[0].split(",");
        var preMoveParts = preMove.split(",");
        var preMove_u = parseInt(firstMoveParts[0]) + parseInt(preMoveParts[0]);
        var preMove_d = parseInt(firstMoveParts[1]) + parseInt(preMoveParts[1]);
        if (preMove_u > 6) {
            preMove_u -= 12;
        }
        if (preMove_d > 6) {
            preMove_d -= 12;
        }
        preMove = `${preMove_u},${preMove_d} `;
        parts[0] = preMove;

        var lastMoveParts = parts.at(-1).split(",");
        var postMoveParts = postMove.split(",");
        var postMove_u = parseInt(lastMoveParts[0]) + parseInt(postMoveParts[0]);
        var postMove_d = parseInt(lastMoveParts[1]) + parseInt(postMoveParts[1]);
        if (postMove_u > 6) {
            postMove_u -= 12;
        }
        if (postMove_d > 6) {
            postMove_d -= 12;
        }
        postMove = ` ${postMove_u},${postMove_d}`;
        parts[parts.length - 1] = postMove
        finalAlg = parts.join("/");
    }
    if (trainerTitle.includes("BLD")) {
        var key = trainerTitle.includes("UFR") ? 'letterSchemeCorners' : 'letterSchemeEdges';
        var algset = algsInfo[caseNum]['algset']
        var letter_pair = translate_blind_letter_pair(defaultSettings[key], currentSettings[key], alg)
        var key = trainerTitle.includes("UFR") ? 'useCornersLetterPairs' : 'useEdgesLetterPairs';
        if (currentSettings[key]) {
            finalAlg = `(${algset}) ${get_blind_word_from_letter_pair(letter_pair)} (${letter_pair})`
        } else {
            finalAlg = `(${algset}) ${letter_pair}`
        }
    }
    window.lastCase = window.currentCase;
    window.currentScramble = finalAlg;
    window.currentCase = caseNum;

    return finalAlg;
}

/*        TIMER        */

var startMilliseconds, stopMiliseconds; // date and time when timer was started
var allowed = true; // allowed var is for preventing auto-repeat when you hold a button
var running = false; var waiting = false;
var timer = null;
var timerActivatingButton = 32; // 17 for ctrl
var timeout;

function msToHumanReadable(duration) {
    if (!Number.isFinite(duration))
        return "-";
    var milliseconds = parseInt((duration % 1000) / 10)
        , seconds = parseInt((duration / 1000) % 60)
        , minutes = parseInt((duration / (1000 * 60)) % 60)
        , hours = parseInt((duration / (1000 * 60 * 60)) % 24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10 && (minutes > 0 || hours > 0)) ? "0" + seconds : seconds;
    milliseconds = (milliseconds < 10) ? "0" + milliseconds : milliseconds;

    hoursString = (hours == 0) ? "" : hours + ":";
    minutesString = (minutes == 0) ? "" : minutes + ":";

    return hoursString + minutesString + seconds + "." + milliseconds;
}

function displayTime() {
    if (running) {
        var d = new Date();
        var diff = d.getTime() - window.startMilliseconds;
        if (diff >= 0)
            timer.innerHTML = msToHumanReadable(diff);
    }
}

function handleTouchEnd(pointerEvent) {
    // allow undefined or touch events
    if (!pointerEvent.pointerType || pointerEvent.pointerType == "touch") {
        if (!window.allowStartingTimer)
            return; // preventing auto-repeat
        if (!running && !waiting) {
            timerStart();
        }
        else {
            timerAfterStop();
        }
    }
}

function handleTouchStart(pointerEvent) {
    // allow undefined or touch events
    if (!pointerEvent.pointerType || pointerEvent.pointerType == "touch") {
        if (running)
            timerStop();
        else {
            timerSetReady(); // set green back
        }
    }
}

function timerStop() {
    waiting = true;
    running = false;
    clearTimeout(timeout);

    var d = new Date();
    stopMiliseconds = d.getTime();
    timer.innerHTML = msToHumanReadable(stopMiliseconds - startMilliseconds);
    timer.style.color = "#850000";

    appendStats();
    showScramble();
}

function timerAbort() {
    waiting = true;
    running = false;
    clearTimeout();
    timer.innerHTML = "0.00";
}

function timerSetReady() {
    waiting = false;
    timer.innerHTML = "0.00";
    timer.style.color = "#008500";
}

function timerStart() {
    var d = new Date();
    startMilliseconds = d.getTime();
    running = true;
    timeout = setInterval(displayTime, 10);
    timer.style.color = currentSettings['colors']['--text'];
}

function timerAfterStop() {
    timer.style.color = currentSettings['colors']['--text'];
}


// http://stackoverflow.com/questions/1787322/htmlspecialchars-equivalent-in-javascript
function escapeHtml(text) {
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}

/// [0: ResultInstance, 1: ResultInstance, ...]

// invoked right after the timer stopped
function appendStats() {
    // assuming the time can be grabbed from timer label, and the case - window.currentCase
    window.timesArray.push(makeResultInstance());
    displayStats();
}

/// removes time from array and invokes displayStats()
function removeTime(i) {
    window.timesArray.splice(i, 1);
    displayStats();
}


function updateInstancesIndeces() {
    for (var i = 0; i < window.timesArray.length; i++)
        window.timesArray[i]["index"] = i;
}

/// requests confirmation and deletes result
function confirmRem(i) {
    var inst = window.timesArray[i];
    if (confirm("Are you sure you want to remove this time?\n\n" + inst["time"])) {
        removeTime(i);
        updateInstancesIndeces();
        renderTimeDetails(inst["case"]);
        displayStats();
    }
}

function confirmRemLast() {
    var i = window.timesArray.length;
    if (i != 0)
        confirmRem(i - 1);
}

/// requests confirmation and empty times array (clear session)
function confirmClear() {
    if (confirm("Are you sure you want to clear session?")) {
        window.timesArray = [];
        document.getElementById('infoHeader').innerHTML = ('')
        displayStats();
    }
}

function saveAlgs() {
    return saveLocal(selectionArrayKey + "customAlgs", JSON.stringify(customAlgs));
}

function loadAlgs() {
    customAlgs = JSON.parse(loadLocal(selectionArrayKey + "customAlgs", '{}'));
    if (customAlgs == null)
        customAlgs = {};
    saveAlgs();
}

function editAlg() {
    var textArea = document.getElementById('algorithmsInput')
    if (textArea.disabled) {
        document.getElementById('algorithmsInput').disabled = false
        document.getElementById('editAlgButton').innerText = 'check'
        return
    } 
    else {
        document.getElementById('algorithmsInput').disabled = true
        document.getElementById('editAlgButton').innerText = 'edit'
        var caseAlgsInfo = JSON.parse(JSON.stringify(algsInfo[hintCase]));
        caseAlgsInfo["a"] = textArea.value.split('\n').filter((line) => line.length > 0)
        customAlgs[hintCase] = caseAlgsInfo
        saveAlgs() 
        return
    }

}

function renderHint(i) {
    document.getElementById('editAlgButton').innerText = "edit"
    var setup = scramblesMap[i];
    var group = getAlgGroup(i);
    var name = getAlgName(i);
    if (trainerTitle.includes("BLD")) {
        if (setup) {
            setup = [translateAlgName(setup[0])];
        }
    }
    var algset = algsInfo[i]['algset'];
    var group_name = `${group} ${name}`
    if (name.startsWith(group)) {
        group_name = name;
    }
    if (group.startsWith(algset)) {
        document.getElementById("boxTitle").innerHTML = group_name;
    }
    else {

        document.getElementById("boxTitle").innerHTML = `${algset} ${group_name}`;
    }
    var longestAlgLength = 0;
    var currentAlgs = algsInfo[i]["a"]
    if (i in customAlgs) {
        currentAlgs = customAlgs[i]["a"]
    }
    for (const alg of currentAlgs) {
        longestAlgLength = Math.max(longestAlgLength, alg.length)
    }
    var algsStr = `<div class='colFlex' style='width: 100%'><label for='algorithmsInput'>Algorithms:</label><textarea id='algorithmsInput' disabled='true' cols='${longestAlgLength}'>`
    for(const alg of currentAlgs) {
        algsStr += alg + "\n"
    }
    algsStr += "</textarea></div>"
    document.getElementById('prevButton').style.opacity = i == 1 ? 0 : 1;
    document.getElementById('nextButton').style.opacity = i == Object.keys(algsInfo).length ? 0 : 1;
    document.getElementById("boxalg").innerHTML = algsStr;
    if (setup) {
        document.getElementById("boxsetup").innerHTML = "Setup:<br/>" + setup[0];
    } else {
        document.getElementById("boxsetup").innerHTML = "Setup:<br/>";
    }
    if (trainerTitle.includes("BLD")) {
        document.getElementById("boxImg").outerHTML = `<div id='boxImg' style='font-size: 8em; color: var(--secondaryText);'>${name}</div>`
    } 
    else {
        document.getElementById("boxImg").src = blobUrls[i];
    }
}

function showHint(element, i) {
    renderHint(i);
    hintCase = i;
    openDialog('hintWindow');
}

function previousCase() {
    hintCase = Math.max(hintCase - 1, 1);
    renderHint(hintCase);
}

function downloadCustomAlgs() {
    const file = new File([JSON.stringify(customAlgs)], 'customAlgsExport.json', {
        type: 'application/json',
      })
    const link = document.createElement('a')
    const url = URL.createObjectURL(file)

    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    link.click()

    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
}

function uploadCustomAlgs() {
    var files = document.getElementById('uploadFile').files;
    if (files.length != 1) {
        return false;
    }
    
    var fr = new FileReader();
    
    fr.onload = function(e) { 
        try {
            var result = JSON.parse(e.target.result)
            customAlgs = result
            renderHint(hintCase)
        } catch (e) {
            console.error(e);
        }
        
    }

    fr.readAsText(files.item(0));
}

function nextCase() {
    var length = Object.keys(algsInfo).length;
    hintCase = Math.min(hintCase + 1, length);
    renderHint(hintCase);
}

function showCaseTimeDetails(caseNum) {
    renderTimeDetails(caseNum);
    openDialog('caseTimeDetails');
}

/// fills resultInfo container with info about given result instance
/// \param r result instsnce (see makeResultInstance)
/// set \param r to null if you want to clear result info
/// displays averages etc.
/// fills "times" right panel with times and last result info
function displayStats() {
    saveLocal(timesArrayKey, JSON.stringify(window.timesArray));
    var len = window.timesArray.length;

    var el = document.getElementById("times");
    if (len == 0) {
        el.innerHTML = "";
        document.getElementById("infoHeader").innerHTML = '0';
        document.getElementById('numCases').innerText = '0';
        return;
    }

        // case-by-case
    var resultsByCase = {}; // [57: [...], 12: [...], ...];
    for (var i = 0; i < len; i++) {
        var currentCase = window.timesArray[i]["case"];
        if (resultsByCase[currentCase] == null)
            resultsByCase[currentCase] = [];
        resultsByCase[currentCase].push(window.timesArray[i]);
    }

    var keys = Object.keys(resultsByCase);
    keys.sort((n1,n2) => n1 - n2);

    var s = "";
    // allocate them inside times span
    for (var j = 0; j < keys.length; j++) {
        var case_ = keys[j];
        var timesString = "";
        var meanForCase = 0.0;
        var i = 0;
        for (; i < resultsByCase[case_].length; i++) {
            timesString += makeHtmlDisplayableTime(resultsByCase[case_][i]);
            if (i != resultsByCase[case_].length - 1)
                timesString += ", ";
            // avg
            meanForCase *= i / (i + 1);
            meanForCase += resultsByCase[case_][i]["ms"] / (i + 1);
        }
        alg_name = getAlgName(case_);
        s += `<div class='timeEntry'><span class='caseNameStats' onclick='showHint(this, ${keys[j]})'>${algsInfo[case_]["algset"]} ${alg_name}</span>`
        s += ` <span class='caseNameStats' onclick=(showCaseTimeDetails(${case_}))>(#${resultsByCase[case_].length}, ⌀${msToHumanReadable(meanForCase)})</span></div>`;
    }
    el.innerHTML = s;
    
    document.getElementById("infoHeader").innerText = (len == 0 ? '' : len + ' ');
    document.getElementById('numCases').innerText = keys.length;
}

function makeResultInstance() {
    var currentTime = document.getElementById("timer").innerHTML;
    var details = window.currentScramble;
    var index = window.timesArray.length;

    return {
        "time": currentTime,
        "ms": timeStringToMseconds(currentTime) * 10, // *10 because current time 1.23 display only hundreths, not thousandth of a second
        "details": details,
        "index": index,
        "case": window.currentCase
    };
}

// converts timestring to milliseconds (int)
// 1:06.15 -> 6615
function timeStringToMseconds(s) {
    if (s == "")
        return -1;
    var parts = s.split(":");
    var secs = parseFloat(parts[parts.length - 1]);
    if (parts.length > 1) // minutes
        secs += parseInt(parts[parts.length - 2]) * 60;
    if (parts.length > 2) // hrs
        secs += parseInt(parts[parts.length - 3]) * 3600;
    if (isNaN(secs))
        return -1;
    return Math.round(secs * 100);
}