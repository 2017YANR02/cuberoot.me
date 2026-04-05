var dialogOpen = false;
var dialogOpenId = null;

function closeDialog(id) {
    var dialog = document.getElementById(id);
    dialog.close();
    dialogOpen = false;
    dialogOpenId = null;
    window.allowStartingTimer = true;
    document.activeElement.blur();
}

function openDialog(id) {
    if (id == 'settings') {
        for (const [key, value] of Object.entries(currentSettings['cubecolors'])) {
            var target = document.getElementById(`cc-${key}`);
            changeUiElementColor(target, value);
        }   
    }
    document.getElementById(id).showModal();
    dialogOpen = true;
    window.allowStartingTimer = false;
    dialogOpenId = id;
}


function dialogClick(event, dialog) {
    var rect = dialog.getBoundingClientRect();
    var isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
    if (!isInDialog) {
        dialog.close();
        dialogOpen = false;
        dialogOpenId = null;
        window.allowStartingTimer = true;
        document.activeElement.blur();
    }
}

function isMobile() {
    var check = false;
    (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
}

function getColorScheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return "dark";
    }
    return "light";
}

function loadLocal(key, fallback) {
    var loaded = localStorage.getItem(key);
    return loaded == null ? fallback : loaded;
}

function saveLocal(key, value) {
    localStorage.setItem(key, value);
}

/// \param r - result instance (see makeResultInstance)
/// \returns html code for displaying the instance
function makeHtmlDisplayableTime(r) {
    var isMostRecent = (r == window.timesArray[window.timesArray.length - 1]);
    var classname = isMostRecent ? "timeResultBold" : "timeResult";
    resultString = "<span class='" + classname + "' title='" +
        escapeHtml(r["details"]) + "' onclick='confirmRem("
        + r["index"] + ")' >" + r["time"] + "</span>";
    return resultString;
}

function uploadLocalStorage() {
    var files = document.getElementById('uploadLS').files;
    if (files.length != 1) {
        return false;
    }
    
    var fr = new FileReader();
    
    fr.onload = function(e) { 
        try {
            var result = JSON.parse(e.target.result)
            for ([key, value] of Object.entries(result)) {
                saveLocal(key, value);
            }
            location.reload()
        } catch (e) {
            console.error(e);
        }
        
    }

    fr.readAsText(files.item(0));
}

function downloadLocalStorage() {
    var date = new Date();
    var datestring = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}T${date.getHours()}${date.getMinutes()}`
    const file = new File([JSON.stringify(localStorage)], `${datestring}-alg-trainers-export.json`, {
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

function get_blind_word_from_letter_pair(letter_pair) {
    try {
        return currentSettings['letterpairs'][letter_pair];
    } catch (e) {
        return e;
    }
}

function get_translated_letter(original_letterscheme, custom_letterscheme, letter) {
    var oi = original_letterscheme.indexOf(letter);
    if (custom_letterscheme.length > oi) {
        return custom_letterscheme[oi]
    } else {
        return original_letterscheme[oi]
    }
}

function translate_blind_letter_pair(original_letterscheme, custom_letterscheme, letter_pair) {
    var original_letterscheme = original_letterscheme.toLowerCase()
    var custom_letterscheme = custom_letterscheme.toLowerCase()
    var letter_pair = letter_pair.toLowerCase();
    if (letter_pair.length == 1)
        return get_translated_letter(original_letterscheme, custom_letterscheme, letter_pair[0]).toUpperCase();
    return (get_translated_letter(original_letterscheme, custom_letterscheme, letter_pair[0]) + get_translated_letter(original_letterscheme, custom_letterscheme, letter_pair[1])).toUpperCase();
}

function translateAlgName(algName) {
    if (trainerTitle.includes("BLD")) {
        var key = trainerTitle.includes("UFR") ? 'letterSchemeCorners' : 'letterSchemeEdges';
        return translate_blind_letter_pair(defaultSettings[key], currentSettings[key], algName);
    }
    return algName;
}

function getAlgName(caseId) {
    return translateAlgName(algsInfo[caseId]["name"]);
}

function translateAlgGroup(group) {
    if (trainerTitle.includes("BLD")) {
        var bufferGroup = group.split(" ");
        var buffer = bufferGroup[0];
        var group = bufferGroup[1];
        var key = trainerTitle.includes("UFR") ? 'letterSchemeCorners' : 'letterSchemeEdges';
        var group = get_translated_letter(defaultSettings[key].toLowerCase(), currentSettings[key].toLowerCase(), group.toLowerCase()).toUpperCase();
        return `${buffer} ${group}`;
    }
    return group;
}

function getAlgGroup(caseId) {
    return translateAlgGroup(algsInfo[caseId]["group"]);
}