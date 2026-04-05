
var selCases = [1, 2];
var selectionPresets = {
    "Default": {
        "selCases": [],
        "selectedAlgSets": {}
    }
}

function getAlgsetIds(algset) {
    if (algsets[algset]) {
        var algsetIds = []
        for (const group of algsets[algset]) {
            algsetIds = algsetIds.concat(algsGroups[group]);
        }
        return algsetIds;
    }
    return [];
}

function getAllValidGroups() {
    var valid = [];
    for (const [algset, groups] of Object.entries(algsets)) {
        if (selectedAlgSets[algset]) {
            valid = valid.concat(groups);
        }
    }
    return valid;
}

function getAllValid() {
    var valid = [];
    var validGroups = getAllValidGroups();
    for (const group of validGroups) {
        valid = valid.concat(algsGroups[group]);
    }
    return valid;
}

function countAlgsetSelected(algset) {
    var algsetIds = getAlgsetIds(algset);
    var selectedCount = 0;
    for (const idx of algsetIds) {
        selectedCount += selCases.includes(idx);
    }
    return selectedCount;
}

function isAlgsetAllSelected(algset) {
    var algsetIds = getAlgsetIds(algset);
    var selectedCount = 0;
    for (const idx of algsetIds) {
        selectedCount += selCases.includes(idx);
    }
    var allSelected = selectedCount == algsetIds.length;
    return allSelected;
}


function updateTitle() {
    var algs = getAllValid().length;
    var allSelector = document.getElementById('allSelector');
    if (selCases.length == algs) {
        allSelector.className = 'borderedContainer itemSel pad';
    } else {
        allSelector.className = 'borderedContainer itemUnsel pad';
    }
    for (const [algset, isShown] of Object.entries(selectedAlgSets)) {
        if (isShown && Object.keys(selectedAlgSets).length > 1) {
            document.getElementById(`${algset}Selector`).className = `borderedContainer ${isAlgsetAllSelected(algset) ? "itemSel" : "itemUnsel"} pad`
            document.getElementById(`${algset}csi`).innerText = countAlgsetSelected(algset);
        }
    }
    document.getElementById("csi").innerHTML = selCases.length;
}

function setSelectionStatus(i, index, active) {
    if (!active && index < 0) {
        return;
    } 
    if (active && index >= 0) {
        return;
    }
    if (!active) {
        selCases.splice(index, 1);
    } else {
        selCases.push(i);
    }
    var element = document.getElementById("itemTd" + i);
    element.className = (active ? "itemSel" : "itemUnsel") + " borderedContainer";
    var groupElement = element.parentElement.previousElementSibling;
    var groupWasSelected = groupElement.classList[1] == 'itemSel';
    if (groupWasSelected && !active) {
        groupElement.className = 'borderedContainer itemUnsel pad groupNameDiv';
    }
    if (!groupWasSelected && active) {
        var groupElements = element.parentElement.childNodes;
        var selectedCount = 0;
        for (var i = 0; i < groupElements.length; i++) {
            selectedCount += groupElements[i].classList[0] == 'itemSel';
        }
        if (selectedCount == groupElements.length) {
            groupElement.className = 'borderedContainer itemSel pad groupNameDiv';
        }
    }
    return active;
}

function getBldInverseCase(caseId) {
    var algset = algsInfo[caseId]['algset'];
    var alg_name = algsInfo[caseId]['name'];
    var inverse_group = `${algset} ${alg_name[1]}`;
    var group_candidates = algsGroups[inverse_group];
    for (inverseCaseId of group_candidates) {
        if (algsInfo[inverseCaseId]['name'][1] == alg_name[0]) {
            var selCaseIndex = selCases.indexOf(inverseCaseId);
            return [inverseCaseId, selCaseIndex];
        }
    }
    return [null, null];
}

function matchInverseSelectionIfNecessary(caseId, matchGoal) {
    if (trainerTitle.includes("BLD")) {
        var inverse = getBldInverseCase(caseId);
        setSelectionStatus(inverse[0], inverse[1], matchGoal);
    }
}

function itemClicked(i) {
    if (window.scramblesMap[i] == null) {
        console.error("is null");
        return;
    }
    var index = selCases.indexOf(i);
    var wasSelected = (index >= 0); // if it was selected the index will be >= 0
    setSelectionStatus(i, index, !wasSelected); // if it was seleted, we want to deselect, otherwise select
    matchInverseSelectionIfNecessary(i, !wasSelected);

    saveSelection();
    updateTitle();
    return !wasSelected;
}

function selectAllNone() {
    var validAlgs = getAllValid();
    var algs = validAlgs.length;
    var allSelected = selCases.length == algs;
    if (!allSelected) {
        selCases = [];
        for (const i of validAlgs)
            selCases.push(i);
    } else {
        selCases = [];
    }
    renderSelection();
    saveSelection();
    resize();
}

/// \returns true if at least one case selected in group groupName
function areAllSelected(groupName) {
    var indeces = algsGroups[groupName];
    for (var i in indeces) {
        if (selCases.indexOf(indeces[i]) == -1)
            return false;
    }
    return true;
}

// select or deselect all cases in the group
function selectCaseGroup(name) {
    var allSelected = areAllSelected(name);
    var indeces = algsGroups[name];
    var firstChild = document.getElementById(`itemTd${indeces[0]}`);
    var groupNameDiv = firstChild.parentElement.previousSibling;
    for (var i = 0; i < indeces.length; i++) {
        var j = selCases.indexOf(indeces[i]);
        setSelectionStatus(indeces[i], j, !allSelected);
        matchInverseSelectionIfNecessary(indeces[i], !allSelected);
    }
    if (allSelected) {
        groupNameDiv.className = 'borderedContainer itemUnsel pad groupNameDiv';
    } else {
        groupNameDiv.className = 'borderedContainer itemSel pad groupNameDiv'
    }
    saveSelection();
    updateTitle();
}

var touchholdtimer;
var touchduration = 1000; //length of time we want the user to touch before we do something

function touchstart(e, func) {
    // e.preventDefault();
    if (!touchholdtimer) {
        touchholdtimer = setTimeout(func, touchduration);
    }
}

function touchend(i) {
    //stops short touches from firing the event
    if (touchholdtimer) {
        clearTimeout(touchholdtimer);
        // itemClicked(i);
        touchholdtimer = null;
    }
}

function makeDivNormal(groupname) {
    var s = "";
    var indeces = algsGroups[groupname];
    var displayGroupname = translateAlgGroup(groupname) 

    s += ` onclick='selectCaseGroup("${groupname}")'><b>${displayGroupname}</b></div><div class='rowFlex' style='flex-wrap: wrap'>`
    var allSelected = true;
    for (var j = 0; j < indeces.length; j++) {
        var i = indeces[j]; // case number
        var sel = (selCases.indexOf(i) != -1);
        var dblclick =` oncontextmenu='showHint(this, ${i}); return false;' `;
        if (!isMobile()) {
            dblclick += ` ondblclick='showHint(this, ${i})'`;
        }
        allSelected &= sel;

        var alg_name = getAlgName(i);
        if (trainerTitle == "Square-1 PBL Trainer" || trainerTitle.includes("BLD")) {
            var content = `<span class='caseSpan'>${alg_name}</span>`;
        } 
        else if (trainerTitle.includes("Square-1")) {
            var caseSpan = `<span class='caseSpan'>${alg_name}</span>`
            if (trainerTitle.includes('OBL')) {
                var nameParts = alg_name.split("|");
                caseSpan =  `<span class='caseSpan'>${nameParts[0]}</span><span class='caseSpan'>${nameParts[1]}</span>`
            }
            var content = `${caseSpan}<img oncontextmenu='return false;' class='caseImage' id='sel${i}' src='${blobUrls[i]}'>`;
        } else {
            var content = `<img oncontextmenu='return false;' class='caseImage' id='sel${i}' src='${blobUrls[i]}'>`;
        }
        s += `<div id='itemTd${i}' ${dblclick} onclick='itemClicked(${i})' class='${(sel ? "itemSel" : "itemUnsel")} borderedContainer' title='${alg_name}' name='${alg_name}'>${content}</div>`
    }
    s = "<div class='colFlex' style='width: fit-content'> <div class='borderedContainer " + (allSelected ? "itemSel" : "itemUnsel") + " pad groupNameDiv'" + s;
    s += "</div></div>";
    return s;
}

function ensureSelectionMatchesShown() {
    var algs = getAllValid();
    var newSelected = selCases.filter((value) => { return algs.includes(value); })
    selCases = newSelected;
}



function selectAlgset(algset) {
    var algsetIds = getAlgsetIds(algset);

    var selectedCount = 0;
    for (const idx of algsetIds) {
        selectedCount += selCases.includes(idx);
    }
    var allSelected = selectedCount == algsetIds.length;
    for (const i of algsetIds) {
        var j = selCases.indexOf(i);
        if (allSelected && j != -1) { // need to delete
            selCases.splice(j, 1);
        }
        if (!allSelected && j == -1) { // need to add
            selCases.push(i);
        }
    }
    selectedAlgSets[algset] = selectedCount != 0 | !selectedAlgSets[algset];
    renderSelection();
    saveSelection();
    resize();
}

function makeAlgsetTitle(algset, enabled) {
    // var width = Math.max((95 / Object.keys(algsets).length), 20) + "%";
    return `<div id='${algset}Selector' class='borderedContainer\
     ${(enabled ? "itemSel" : "itemUnsel")} pad' 
     style='width: 7em; opacity: ${enabled ? 1.0 : 0.5}' 
     onclick='selectAlgset("${algset}")'><b>${algset} 
     (<span id='${algset}csi'>${enabled ? "0" : "-"}</span>/${getAlgsetIds(algset).length})</b></div>`;
}

function addPreset(name_) {
    var name = name_;
    if (name_ === null) {
        name = document.getElementById('newPresetInput').value;
    }
    if (name === '') {
        alert('Your preset must have a name.')
        return;
    }
    if (selectionPresets[name] != null) {
        addPreset(name + '1');
        return;
    }
    selectionPresets[name] = {
        'selCases': [],
        'selectedAlgSets': {}
    };
    Object.assign(selectionPresets[name]['selCases'], selCases);
    Object.assign(selectionPresets[name]['selectedAlgSets'], selectedAlgSets);
    localStorage.setItem(selectionArrayKey + 'Presets', JSON.stringify(selectionPresets));
    renderPresets();
}

function updatePreset(name) {
    if (window.confirm(`Are you sure you want to set preset ${name} to the current selection?`)) {
        selectionPresets[name] = {
            'selCases': [],
            'selectedAlgSets': {}
        };
        Object.assign(selectionPresets[name]['selCases'], selCases);
        Object.assign(selectionPresets[name]['selectedAlgSets'], selectedAlgSets);
        localStorage.setItem(selectionArrayKey + 'Presets', JSON.stringify(selectionPresets));
    }
}

function deletePreset(name) {
    if (window.confirm(`Are you sure you want to delete preset ${name}?`)) {
        delete selectionPresets[name];
        localStorage.setItem(selectionArrayKey + 'Presets', JSON.stringify(selectionPresets));
        renderPresets();
    }
}

function ensureSelCasesIncludeInverseWhenBlind() {
    if (trainerTitle.includes("BLD")) {
        var withInverse = []
        for (const caseId of selCases) {
            if (!withInverse.includes(caseId)) {
                withInverse.push(caseId);
            }
            inverse = getBldInverseCase(caseId)[0];
            if (!withInverse.includes(inverse)) {
                withInverse.push(inverse)
            }
        }
        selCases = [...withInverse];
    }
}

function ensureAlgsetsAreSelected() {
    for (const i of selCases) {
        selectAlgsets[algsInfo[i].algset] = true;
    }
}

function presetsPost(name) {
    ensureSelCasesIncludeInverseWhenBlind();
    Object.assign(selectedAlgSets, selectionPresets[name]['selectedAlgSets']);
    renderSelection();
    saveSelection();
}

function usePreset(name) {
    selCases = [...selectionPresets[name]['selCases']];
    presetsPost(name);
}

function addPresetToSelection(name) {
    selCases.push(...selectionPresets[name]['selCases']);
    selCases = [...new Set(selCases)];
    presetsPost(name);
}

function removePresetFromSelection(name) {
    var selCaseSet = new Set(selCases);
    var presetSet = new Set(selectionPresets[name]['selCases'])
    selCases = [...selCaseSet.difference(presetSet)];
    presetsPost(name);
}


function renderPresets() {
    var previousText = '';
    try {
        previousText = document.getElementById('newPresetInput').value;
    } catch(e) {}
    var s = "";
    for (const [name, preset] of Object.entries(selectionPresets)) {
        s += `<div class='settingsEntry'><span>${name}</span><div class='plusMinus'>\
        <span onclick='addPresetToSelection("${name}")' style='width: 1em' class='abutton'>+</span>\
        <span onclick='removePresetFromSelection("${name}")' style='width: 1em' class='abutton'>-</span>\
        <span onclick='deletePreset("${name}")' class='abutton'>Del</span>\
        <span onclick='updatePreset("${name}")' class='abutton'>Set</span>\
        <span onclick='usePreset("${name}")' class='abutton'>Use</span></span></div></div>`;
    }
    s += `<div class='settingsEntry'><input type='text' id='newPresetInput' value='${previousText}' style='width: 100%' placeholder='New Preset'/><span class='abutton' onclick='addPreset(null)'>Add</span></div>`;
    document.getElementById('presetsSettings').innerHTML = s;
}


/// iterates the scramblesMap and highlights HTML elements according to the selection
function renderSelection() {
    var groups = getAllValidGroups();
    var algs = getAllValid().length;
    var s = "";
    s += `<div id='allSelector' class='borderedContainer  ${(selCases.length == algs ? "itemSel" : "itemUnsel")} pad' onclick='selectAllNone()'><b>All Cases (<span id='csi'></span>/${algs})</b></div>`;
    if (Object.keys(selectedAlgSets).length > 1) {
        s += "<div class='rowFlex' style='flex-wrap: wrap;'>"
        for (const [algset, isShown] of Object.entries(selectedAlgSets)) {
            s += makeAlgsetTitle(algset, isShown);
        }
        s += "</div>"
    }

    for (const [algset, isShown] of Object.entries(selectedAlgSets)) {
        if (isShown) {
            if (Object.keys(selectedAlgSets).length > 1) {
                s += `<div class="borderedContainer pad" style='background-color: var(--backgroundDarker); color: var(--text);'><b>${algset}</b></div>`
            }
            for (const key of algsets[algset]) {
                s += makeDivNormal(key)
            }
        }
    }

    document.getElementById("cases_selection").innerHTML = s;
    ensureSelectionMatchesShown();
    updateTitle();
    renderPresets();
}


function saveSelection() {
    localStorage.setItem(selectionArrayKey, JSON.stringify(selCases));
    localStorage.setItem(selectionArrayKey + "AlgSets", JSON.stringify(selectedAlgSets));
}

function loadSelection() {
    var cases = loadLocal(selectionArrayKey);
    if (cases != null)
        selCases = JSON.parse(cases);
    var loadedAlgSets = loadLocal(selectionArrayKey + "AlgSets");
    if (loadedAlgSets != null)  {
        tempAlgset = JSON.parse(loadedAlgSets);
        for (const [algset, isShown] of Object.entries(selectedAlgSets)) {
            if (tempAlgset[algset]) {
                selectedAlgSets[algset] = tempAlgset[algset];
            }
        }
    }
    var preset = localStorage.getItem(selectionArrayKey + 'Presets')
    if (preset != null) {
        selectionPresets = JSON.parse(preset);
    }
}
