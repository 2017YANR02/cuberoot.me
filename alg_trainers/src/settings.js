var defaultColors = {
    'light': {
        '--text': "oklch(25% 0 0)",
        '--background': "oklch(96% 0.01 97)",
        '--secondary': "oklch(75% 0.09 99)",
        '--primary': "oklch(45% 0.08 136)",
        '--accent': "oklch(85% 0.16 98)"
    },
    "dark": {
        '--text': "oklch(99% 0 91)",
        '--background': "oklch(33% 0.0 0)",
        '--secondary': "oklch(69% 0.09 98)",
        '--primary': "oklch(82% 0.07 135)", 
        '--accent': "oklch(91% 0.16 98)"
    }  
}
var defaultSettings = {
    'baseSize':  isMobile() ? 1.0 : 1.0,
    'timerSize': 5.0,
    'scrambleSize': 2,
    'weightedChoice': true,
    'weightedChoiceTime' : false,
    'colors': {},
    'cubecolors': {
        "white": "#fafafa",
        "ignore": "#777",
        "black": "#222",
        "lightblue": "#A0CBE8",
        "blue": "#4E79A7",
        "red": "#E15759",
        "pink": "#FF9D9A",
        "beige": "#f4f3aa",
        "yellow": "#F1CE63",
        "green": "#59A14F",
        "lightgreen": "#8CD17D",
        "purple": "#B07AA1",
        "orange": "#F28E2B"
    },
    'selectedAlgSets': {},
    'letterSchemeCorners': "abcdefghijklmnopqrstuvwx",
    'letterSchemeEdges': "abcdefghijklmnopqrstuvwx",
    'letterpairs': {},
    'useEdgesLetterPairs': false,
    'useCornersLetterPairs': false,
};

var defaultCubeColors = {
    'default': {...defaultSettings['cubecolors']},
    'redgreen': {
        "white": "#fafafa",
        "ignore": "#777",
        "black": "#222",
        "lightblue": "#A0CBE8",
        "blue": "#4E79A7",
        "red": "#E157BD",
        "pink": "#FF9AD5",
        "beige": "#F4F3AA",
        "yellow": "#F1CE63",
        "green": "#59A14F",
        "lightgreen": "#8CD17D",
        "purple": "#900067",
        "orange": "#9E6405"
    },
    'blueyellow': {
        "white": "#fafafa",
        "ignore": "#777",
        "black": "#222",
        "lightblue": "#A0E8E5",
        "blue": "#4E75A7",
        "red": "#E15759",
        "pink": "#FF9D9A",
        "beige": "#f4f3aa",
        "yellow": "#F1CE63",
        "green": "#59A14F",
        "lightgreen": "#8CD17D",
        "purple": "#B07AA1",
        "orange": "#F28E2B"
    }
}

var currentSettings = {};
Object.assign(currentSettings, defaultSettings);
Object.assign(currentSettings['colors'], defaultColors[getColorScheme()]);
Object.assign(currentSettings['selectedAlgSets'], window.selectedAlgSets);


function loadSettings() {
    var loaded = localStorage.getItem('ALLGSettings');
    if (loaded != null) {    
        currentSettings = JSON.parse(localStorage.getItem('ALLGSettings'));
        for (const [key, value] of Object.entries(defaultSettings)) {
            if (!(key in currentSettings)) {
                currentSettings[key] = value;
            }
        }
    };
}

function saveSettings() {
    localStorage.setItem('ALLGSettings', JSON.stringify(currentSettings));
}


function clip(x, l, h) {
    return Math.min(Math.max(x, l), h);
}

function toSrgb(color) {
    return color.toGamut({'space': 'sRGB'});
}

function toOklchStr(color) {
    var s = 'oklch(';
    s += Math.round(100 * color.oklch.l) + '% ';
    s += Math.round(100 * color.oklch.c) / 100 + ' ';
    var h = Number.isNaN(color.oklch.h) ? 0 : color.oklch.h;
    s += Math.round(h) + ')'
    return s;
}

function computeColors() {
    var body = document.body;
    var contrastAlg = 'WCAG21';
    var minContrast = 3;
    var textColor = toSrgb(new Color(currentSettings.colors['--text']));
    var backgroundColor = toSrgb(new Color(currentSettings.colors['--background']));
    var secondaryColor = toSrgb(new Color(currentSettings.colors['--secondary']));
    var primaryColor = toSrgb(new Color(currentSettings.colors['--primary']));
    var accentColor = toSrgb(new Color(currentSettings.colors['--accent']));
    currentSettings.colors['--text'] = toOklchStr(textColor);
    currentSettings.colors['--background'] = toOklchStr(backgroundColor);
    currentSettings.colors['--secondary'] = toOklchStr(secondaryColor);
    currentSettings.colors['--primary'] = toOklchStr(primaryColor);
    currentSettings.colors['--accent'] = toOklchStr(accentColor);
    for (const [key, color] of Object.entries(currentSettings['colors'])) {
        try {
            document.getElementById(key).value = color;
        } catch (e) {}
        body.style.setProperty(key, color);
    }

    var contrastBackText = backgroundColor.contrast(textColor, contrastAlg);
    var contrastBacksecondary = backgroundColor.contrast(secondaryColor, contrastAlg);
    var contrastBackprimary = backgroundColor.contrast(primaryColor, contrastAlg);
    var contrastBackAccent = backgroundColor.contrast(accentColor, contrastAlg);
    var contrastTextsecondary = textColor.contrast(secondaryColor, contrastAlg);
    var contrastTextprimary = textColor.contrast(primaryColor, contrastAlg);
    var contrastTextAccent = textColor.contrast(accentColor, contrastAlg);
    var buttonText = contrastBacksecondary > contrastTextsecondary ? 'var(--background)' : "var(--text)";
    var primaryText = contrastBackprimary > contrastTextprimary ? "var(--background)" : "var(--text)";
    var accentText = contrastBackAccent > contrastTextAccent ? "var(--background)" : "var(--text)";
    body.style.setProperty('--secondaryText', buttonText);
    body.style.setProperty('--primaryText', primaryText);
    body.style.setProperty('--accentText', accentText);

    if (contrastBackprimary < minContrast) {
        var sign = primaryColor.oklch.l > backgroundColor.oklch.l ? 1 : -1;
        primaryColor.oklch.l += sign * 0.3;
    }
    body.style.setProperty('--primaryBG', toOklchStr(primaryColor));
    primaryColor.oklch.l += backgroundColor.oklch.l > primaryColor.oklch.l ? 0.1 : -0.1;
    body.style.setProperty('--primaryBGHover', toOklchStr(primaryColor));
    secondaryColor.oklch.l += backgroundColor.oklch.l > secondaryColor.oklch.l ? 0.1 : -0.1;
    body.style.setProperty('--secondaryHover', toOklchStr(secondaryColor));
    accentColor.oklch.l += backgroundColor.oklch.l > accentColor.oklch.l ? 0.1 : -0.1;
    body.style.setProperty('--accentHover', toOklchStr(accentColor));
    backgroundColor.oklch.l -= 0.1;
    body.style.setProperty('--backgroundDarker', toOklchStr(backgroundColor));
    try {
        document.getElementById('timer').style.color = toOklchStr(textColor);
    } catch(e) {}
}

function changeUiElementColor(target, color) {
    var contrastAlg = 'WCAG21';
    var color = toSrgb(new Color(color));
    var textColor = toSrgb(new Color(currentSettings.colors['--text']));
    var backgroundColor = toSrgb(new Color(currentSettings.colors['--background']));
    var contrastText = color.contrast(textColor, contrastAlg);
    var contrastBack = color.contrast(backgroundColor, contrastAlg);
    if (contrastText > contrastBack) {
        target.style.color = textColor.toString({format: "oklch"});
    } else {
        target.style.color = backgroundColor.toString({format: "oklch"});
    }
    target.style.backgroundColor = toOklchStr(color);
    target.value = toOklchStr(color);
}

function applySettings() {
    try {    
        document.getElementById('timer').style.fontSize = currentSettings['timerSize'] + "em";
        document.getElementById('scramble').style.fontSize = currentSettings['scrambleSize'] + "em";
        document.getElementById("weighted_choice_on_off").checked = currentSettings['weightedChoice'];
        document.getElementById("weighted_choice_time_on_off").checked = currentSettings['weightedChoiceTime']
        document.getElementById('cornerSchemeInput').value = currentSettings['letterSchemeCorners'];
        document.getElementById('edgeSchemeInput').value = currentSettings['letterSchemeEdges'];
        document.getElementById('edges_letter_pairs_on_off').checked = currentSettings['useEdgesLetterPairs'];
        document.getElementById('corners_letter_pairs_on_off').checked = currentSettings['useCornersLetterPairs'];
    } catch(e) {}
    document.body.style.fontSize = currentSettings['baseSize'] + "em";
    computeColors();
}


function adjustSize(item, inc) {
    if (item == 'timer') {
        currentSettings['timerSize'] += inc;
        document.getElementById('timer').style.fontSize = currentSettings['timerSize'] + "em";
    }

    if (item == 'scramble') {
        currentSettings['scrambleSize'] += inc;
        document.getElementById('scramble').style.fontSize = currentSettings['scrambleSize'] + "em";
    }
    if (item == 'body') {
        currentSettings['baseSize'] += inc
        document.body.style.fontSize = currentSettings['baseSize'] + "em";
        resize();
    }
    saveSettings();
}

function changeColor(event) {
    var newColor = event.target.value;
    var id = event.target.id;
    currentSettings['colors'][id] = newColor;
    document.body.style.setProperty(id, newColor);
    computeColors();
    saveSettings();
}

function changeCubeColor(event, key) {
    changeUiElementColor(event.srcElement, event.srcElement.value)
    currentSettings['cubecolors'][key]  = event.srcElement.value;
    saveSettings();
}

function changeSettingsKey(event, key) {
    currentSettings[key] = event.srcElement.value;
    saveSettings();
}

function resetCubeColors(key) {
    for ([key, value] of Object.entries(defaultCubeColors[key])) {
        changeUiElementColor(document.getElementById(`cc-${key}`), value);
        currentSettings['cubecolors'][key] = value;
    }
    saveSettings();
}

function resetStyle(dark) {
    var body = document.body;
    Object.assign(currentSettings['colors'], defaultColors[dark]);
    for (const [key, value] of Object.entries(currentSettings['colors'])) {
        document.getElementById(key).value = value;
        body.style.setProperty(key, value);
    }
    computeColors();
    saveSettings();
}

function toggleSetting(element, key) {
    currentSettings[key] = !currentSettings[key];
    element.checked = currentSettings[key];
    saveSettings();
}

function uploadLetterPairs() {
    var files = document.getElementById('uploadLP').files;
    if (files.length != 1) {
        return false;
    }

    var fr = new FileReader();
    
    fr.onload = function(e) { 
        try {
            var result = JSON.parse(e.target.result);
            currentSettings['letterpairs'] = result;
            saveSettings();
            window.alert("Letter pair words changed successfully!")
        } catch (e) {
            console.error(e);
            window.alert("Something went wrong while parsing your letter pairs. The file should be a json mapping from your letter pair to a word.")
        }
        
    }
    fr.readAsText(files.item(0));
}