function initHotKeys() {

  var bodyEl = document.body;
  var searchInput = document.getElementById('search');

  document.addEventListener('keydown', function (event) {
    if (event.defaultPrevented) {
      return;
    }

    var key = event.key || event.keyCode;

    // ESC to close search window
    if (key === 'Escape' || key === 'Esc' || key === 27) {
      document.body.classList.remove('has-active-search-window');
    }

    // Ctrl or Meta + / to open toggle window
    if (
      (event.getModifierState("Control") || event.getModifierState("Meta")) &&
      (key === '/' || key === 'Period' || key === 58)
      ) {
      if (bodyEl.classList.contains('has-active-search-window')) {
        // if it's already open don't do anything!
      } else {
        event.preventDefault();
        document.body.classList.add('has-active-search-window');
        searchInput.focus();
      }
    }

    //when search is active TAB puts search input into focus
    if (bodyEl.classList.contains('has-active-search-window')) {
      if (key === 'Tab' || key === 'Tab' || key === 9) {
        searchInput.focus();
      }
    }

    if (bodyEl.classList.contains('has-active-search-window')) {
      if (key === 'Enter' || key === 'Return' || key === 13) {
        event.preventDefault();
        let firstresult = document.querySelectorAll("div#full-results a")[0];
        firstresult.click();
      }
    }
  });
};


// search functionality
function debounce(func, wait) {
  var timeout;

  return function () {
    var context = this;
    var args = arguments;
    clearTimeout(timeout);

    timeout = setTimeout(function () {
      timeout = null;
      func.apply(context, args);
    }, wait);
  };
}

// The strategy is as follows:
// First, assign a value to each word in the document:
//  Words that correspond to search terms (stemmer aware): 40
//  Normal words: 2
//  First word in a sentence: 8
// Then use a sliding window with a constant number of words and count the
// sum of the values of the words within the window. Then use the window that got the
// maximum sum. If there are multiple maximas, then get the last one.
// Enclose the terms in <b>.
function makeTeaser(body, terms) {
  var TERM_WEIGHT = 40;
  var NORMAL_WORD_WEIGHT = 2;
  var FIRST_WORD_WEIGHT = 8;
  //var TEASER_MAX_WORDS = 17;
  var TEASER_MAX_CHARS = 63;

  var stemmedTerms = terms.map(function (w) {
    return elasticlunr.stemmer(w.toLowerCase());
  });

  var termFound = false;
  var index = 0;
  var weighted = []; // contains elements of ["word", weight, index_in_document]

  // split in sentences, then words
  var sentences = body.toLowerCase().split(". ");

  for (var i in sentences) {
    var words = sentences[i].split(" ");
    var value = FIRST_WORD_WEIGHT;

    for (var j in words) {
      var word = words[j];

      if (word.length > 0) {
        for (var k in stemmedTerms) {
          if (elasticlunr.stemmer(word).startsWith(stemmedTerms[k])) {
            value = TERM_WEIGHT;
            termFound = true;
          }
        }
        weighted.push([word, value, index]);
        value = NORMAL_WORD_WEIGHT;
      }

      index += word.length;
      index += 1;  // ' ' or '.' if last word in sentence
    }

    index += 1;  // because we split at a two-char boundary '. '
  }

  if (weighted.length === 0) {
    return body;
  }

  var windowWeights = [];
  var windowSize = 0;

  // loop over words (weighted) till max chars is reached adding a counter to windowSize every time a new word has passed
  var sumChars = 0;
  for (var i = 0; i < weighted.length; i++) {
    sumChars += weighted[i][0].length;
    if (sumChars <= TEASER_MAX_CHARS) {
      windowSize++;
    }
  }

  // We add a window with all the weights first
  var curSum = 0;
  for (var i = 0; i < windowSize; i++) {
    curSum += weighted[i][1];
  }
  windowWeights.push(curSum);

  for (var i = 0; i < weighted.length - windowSize; i++) {
    curSum -= weighted[i][1];
    curSum += weighted[i + windowSize][1];
    windowWeights.push(curSum);
  }

  // If we didn't find the term, just pick the first window
  var maxSumIndex = 0;
  if (termFound) {
    var maxFound = 0;
    // backwards
    for (var i = windowWeights.length - 1; i >= 0; i--) {
      if (windowWeights[i] > maxFound) {
        maxFound = windowWeights[i];
        maxSumIndex = i;
      }
    }
  }

  var teaser = [];
  var startIndex = weighted[maxSumIndex][2];
  for (var i = maxSumIndex; i < maxSumIndex + windowSize; i++) {
    var word = weighted[i];
    if (startIndex < word[2]) {
      // missing text from index to start of `word`
      teaser.push(body.substring(startIndex, word[2]));
      startIndex = word[2];
    }

    startIndex = word[2] + word[0].length;
    teaser.push(body.substring(word[2], startIndex));

  }
  teaser.push("???");
  return teaser.join("");
}

function formatSearchResultTitle(item) {
  var pathArray = item.ref.split('/');

  var firstPartTitle = pathArray[3];
  let firstTitleCapitals = firstPartTitle.charAt(0).toUpperCase() + firstPartTitle.slice(1);

  var lastPartTitle = item.doc.title;

  var fullTitle = firstTitleCapitals + '<span class="gray1 dib pl2">' + ' / ' + lastPartTitle + '</span>';

  return fullTitle;
}

function formatSearchResultItem(item, terms) {
  var li = document.createElement("li");
  var createA = document.createElement("a");
  li.appendChild(createA);
  var teaserTitle = formatSearchResultTitle(item);
  li.classList.add("search-results__item");
  var hrefA = item.ref;
  createA.setAttribute('href', hrefA);
  createA.setAttribute('class', 'no-underline db pl1 pv2');
  createA.innerHTML = `<span class="capitalize ph3">${teaserTitle}</span>`;
  createA.innerHTML += `<span class='dn arrow fr'>???</span>`;
  createA.innerHTML += `<div class="truncate pr2 ph3">${makeTeaser(item.doc.body, terms)}</div>`;
  return li;
}

function initSearch() {
  var searchInput = document.getElementById("search");
  var searchForm = document.getElementById("search-form");
  var inputReset = searchForm.nextElementSibling;

  if (!searchInput) {
    return;
  }
  var glossaryResults = document.querySelector(".glossary-results");
  var glossaryResultsHeader = document.querySelector(".glossary-results__header");
  var glossaryResultsItem = document.querySelector(".glossary-results__item");
  var searchResults = document.querySelector(".search-results");
  var searchResultsHeader = document.querySelector(".search-results__header");
  var searchResultsItems = document.querySelector(".search-results__items");
  var MAX_ITEMS = 200;
  var options = {
    bool: "AND",
    expand: true, // turn on partial word search
    fields: {
      title: { boost: 2 },
      body: { boost: 1 },
    }
  };
  var currentTerm = "";
  var index = elasticlunr.Index.load(window.searchIndex);
  // toggle search window
  var toggleSearchWindow = document.getElementById('js-search-window-toggle');
  var bodyEl = document.body;
  var searchOverlay = document.getElementById('search-overlay');
  var searchWindow = document.getElementById('search-window');
  var searchActive = bodyEl.classList.contains('has-active-search-window');


  if (toggleSearchWindow !== null) {
    toggleSearchWindow.onclick = function () {
      inputReset.style.display = "none";

      //activate search
      bodyEl.classList.toggle('has-active-search-window');
      //put input in focus when activating search
      searchInput.focus();

      searchInput.value = "";
      searchResultsHeader.value = "";
      searchResults.style.display = searchInput.value.trim() === "" ? "none" : "block";
    }
    searchOverlay.addEventListener('click', function (e) {
      if (!searchWindow.contains(e.target)) {
        bodyEl.classList.toggle('has-active-search-window');
      }
    })
  }

  searchInput.addEventListener("keyup", debounce(function () {
    inputReset.style.display = "block";
    glossaryResults.style.display = "none";
    searchResultsHeader.value = "";
    var term = searchInput.value.trim();
    /*
    //removed to fix: a state where there???s a valid search term, but no results

    if (term === currentTerm || !index) {
      return;
    }*/

    searchResults.style.display = term === "" ? "none" : "block";
    searchResults.style.overflowY = term === "" ? "hidden" : "scroll";
    searchResultsItems.innerHTML = "";
    if (term === "") {
      inputReset.style.display = "none";
      return;
    }

    for (let entry of glossary) {
      if (entry.name === term.toLowerCase()) {
        glossaryResults.style.display = "block";
        glossaryResultsItem.innerHTML = `
        <a href="${entry.link}"><h3 class="black">${entry.name}</h3>
        <p class="black">${entry.desc}</p>
         <span class="db tr black fw5 mb3" style="font-family: 'Inter UI', sans-serif;">Read more in Glossary -></span></a>
        `
        break;
      } else if (entry.symbol === term) {
        glossaryResults.style.display = "block";
        glossaryResultsItem.innerHTML = `
        <a href="${entry.link}"><h3 class="black"><code class="pa0 red3 mr1">${entry.symbol}</code>${entry.name}</h3>
        <p class="black">${entry.desc}</p>
         <span class="db tr black fw5 mb3" style="font-family: 'Inter UI', sans-serif;">Read more in Documentation -></span></a>
        `
      }
    }

    var results = index.search(term, options).filter(function (r) {
      return r.doc.body !== "";
    });

    if (results.length === 0) {
      searchResultsHeader.innerText = `No search results for '${term}'.`;
      return;
    }

    currentTerm = term;
    searchResultsHeader.innerText = `${results.length} search results for '${term}':`;
    for (var i = 0; i < Math.min(results.length, MAX_ITEMS); i++) {
      if (!results[i].doc.body) {
        continue;
      }
      searchResultsItems.appendChild(formatSearchResultItem(results[i], term.split(" ")));
    }
  }, 150));

  // reset input button
  inputReset.onclick = function () {
    document.getElementById('search-form').reset();
  }
  searchForm.addEventListener("reset", function (event) {
    var e = document.createEvent('KeyboardEvent');
    e.initEvent("keyup", false, true);
    searchInput.dispatchEvent(e);
  });

}

if (document.readyState === "complete" ||
  (document.readyState !== "loading" && !document.documentElement.doScroll)
) {
} else {
  document.addEventListener("DOMContentLoaded", function () {
    initSearch();
    initHotKeys();
  });
}

// Scroll to current document in nav list.
let docsNavScroll = function () {
  let docsDetails = document.querySelectorAll("nav ul details")
  for (let details in docsDetails) {
    if (docsDetails[details].open) docsDetails[details].scrollIntoView()
  }
}

if (window.location.href.includes("docs")) {
  // tooltip behaviour for standard library page
  tippy('.tooltip', {
    content(reference) {
      const title = reference.getAttribute('title')
      reference.removeAttribute('title')
      return title
    },
    animateFill: false,
    animation: 'fade'
  })

  // on mobile, dropdown selections go to the option

  let docsSelect = document.getElementById('docsSelect');
  let goTo = function () {
    let url = docsSelect.options[docsSelect.selectedIndex].value;
    if (url.startsWith("http")) {
      document.location.assign(url);
    }
  }

  docsSelect.addEventListener('change', goTo);
  // docs autoscroll to current page
  docsNavScroll();
}

var getParents = function (elem, selector) {

  // Element.matches() polyfill
  if (!Element.prototype.matches) {
    Element.prototype.matches =
      Element.prototype.matchesSelector ||
      Element.prototype.mozMatchesSelector ||
      Element.prototype.msMatchesSelector ||
      Element.prototype.oMatchesSelector ||
      Element.prototype.webkitMatchesSelector ||
      function(s) {
        var matches = (this.document || this.ownerDocument).querySelectorAll(s),
          i = matches.length;
        while (--i >= 0 && matches.item(i) !== this) {}
        return i > -1;
      };
  }

  // Set up a parent array
  var parents = [];

  // Push each parent element to the array
  for ( ; elem && elem !== document; elem = elem.parentNode ) {
    if (selector) {
      if (elem.matches(selector)) {
        parents.push(elem);
      }
      continue;
    }
    parents.push(elem);
  }

  // Return our parent array
  return parents;

};




// same-page navigation on-scroll behaviour

if (document.body.classList.contains("page-indiced") || document.getElementById("event_months")) {
  let all = document.querySelectorAll("nav.fixed-xl li a");

  // smooth scrolling on click
  all.forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      let target = document.querySelector(event.target.hash);
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

  window.addEventListener("scroll", event => {
    let fromTop = window.scrollY;
    let current;
    all.forEach(link => {
      if (!link.hash) return;
      let section = document.querySelector(link.hash);
      let sectionChildren = document.querySelector(link.hash).nextElementSibling;
      if (!sectionChildren) sectionChildren = section;

      if (
        ((section.offsetTop <= fromTop) ||
          (sectionChildren.offsetTop <= fromTop)) &&
        (section.offsetTop + section.offsetHeight + sectionChildren.offsetHeight > fromTop)
        && !current
      ) {
        current = link;
      }
    });
    if (current) {
      Array.from(document.querySelectorAll('.current')).forEach(current => current.classList.remove('current'));
      const parents = getParents(current, 'ol');
      current.classList.add('current');
      parents.forEach(current => current.classList.add('current'));
    }
  })
};

let oceanvid = document.getElementById("ocean");

if ((oceanvid !== null) && (window.innerWidth > window.innerHeight)) {
  oceanvid.innerHTML = `<source
  src="https://media.urbit.org/site/sea30-1440.mp4"
  type="video/mp4"/>
  Your browser does not support the video tag.`
}