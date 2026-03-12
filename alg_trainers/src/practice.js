recapArray = [];
/// \param m = mode: 0 = selection, 1 = practicing, 2 = recap
function changeMode(m) {
    if (window.history.state == 'select' && m != 'select' && m != null) {
        window.history.pushState(m, '', "?" + m);
    } else {
        window.history.replaceState(m, '', "?" + m);
    }
    // if (m == 'select') {
    //     window.history.replaceState(m, '', "?" + m);
    // }
    showMode(m);
}

function showMode(m)
{
    if (window.running) {
        timerAbort();
    }
    if (m == null) {
        m = 'select'
    }
    var pr = document.getElementById("practiceLayout");
    var se = document.getElementById('selectionLayout');
    document.getElementById('bodyid').style.background = m == 'select' ? 'var(--background)' : 'var(--backgroundDarker)'; 
    pr.style.display = (m != 'select') ? 'flex' : 'none';
    se.style.display = (m == 'select') ? 'flex' : 'none';

    if (m == 'recap' || m == 'train') {
        document.documentElement.style.setProperty("overscroll-behavior", "none");
        document.documentElement.style.setProperty("overflow-x", "hidden");
    } else {
        document.documentElement.style.setProperty("overscroll-behavior", "auto");
        document.documentElement.style.setProperty("overflow-x", "auto");
    }

    if (m == 'recap') {
        // recap
        window.allowStartingTimer = true;
        var casesAmount = selCases.length;
        recapArray = selCases.slice();
        showScramble();
    }
    else if (m == 'train') {
        // practice
        window.allowStartingTimer = true;
        recapArray = [];
        showScramble();
    }
    else if (m == 'select') { 
        // select
        window.allowStartingTimer = false;
        recapArray = [];
        renderSelection();
    }
    resize('');
}

/// \returns random integer from 0 to h
function randomNum(h) {
    return Math.floor(Math.random() * h);
}

// binary search, from https://stackoverflow.com/questions/69335458/weighted-probability-random-choice-array
function find(arr, x , start=0, end=arr.length) {
    if(end < start) return -1;
    else if(end == start) return end;
    const mid = Math.floor((start + end) / 2);  
    if(arr[mid] === x) return mid+1;
    else if(arr[mid] < x) return find(arr, x, mid+1, end);
    else
      return find(arr, x, start, mid);
}

// weighted random choice from array "items". weights has to be the same length as items and weights have to be cumulative
// weights do not have to be normalized
function weightedRandomElement(items, weights) {
    return items[find(weights, Math.random()*weights[weights.length-1])];
};
