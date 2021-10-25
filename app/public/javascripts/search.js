// Get twitter information when searched
const twitterProfileAmount = 5;
let count = 0;
var warningText = '';
const warningDiv = document.getElementById('warning');

var serverDataPreped = {
    hashtagData: [],
    importantWords: []
};

const twitterData = (event) => {
    event.preventDefault();
    let searchedTerm = document.getElementById('searchText').value
    document.getElementById('searchText').value = '';

    searchedTerm = searchedTerm.replace(/[^a-zA-Z0-9\_]+/g, ' ');
    searchedTerm = searchedTerm.trim();

    while (warningDiv.firstChild) {
        warningDiv.removeChild(warningDiv.firstChild)
    }
    if (searchedTerm == '') {
        appendWarning('Bad search, please only use letters.');
    }
    else {
        const searchedTerms = searchedTerm.split(' ');
        searchedTerms.forEach(element => {
            fetch(`/data/twitter/${element.toLowerCase()}`)
                .then((response) => {
                    return response.json();
                })
                .then((data) => {
                    // Handle server data block

                    // Ensure that warningText is blank
                    warningText = '';

                    // Set up, handle misuse, and draw visualisations
                    SetUpServerData(data);

                    // This only does something if warningText has been updated
                    appendWarning(warningText);

                    // Reset warning text
                    warningText = '';

                    // if (data.source == "No Source") {
                    //     // No source block
                    //     appendWarning('No data was able to be retrieved!');
                    // }
                })
                .catch((error) => {
                    // There may be an issue with .env / twitter API key stuff
                    console.log(error);
                })
        });
    }
}


// Function to set up data object that can be handled by visualisations.js
function SetUpServerData(data) {
    let hashtagObjArray = [];
    let importantWordsObj = { name: data.id, children: [] };

    const found = serverDataPreped.importantWords.some(el => el.name === data.id);

    
    if (found) { // Handles a term being entered twice on the page
        console.log("Duplicate Found!");
        warningText = 'Search term already exists on the page!';
    } else if (data.source == "No Source") { // Handles no hashtag data being found
        console.log("No results found");
        warningText = 'No data was able to be retrieved for your query!';
    } else { // If data is found and is not duplicate, sets up data objects and draws visualisations
        console.log("No duplicate found!");
        // Remove the oldest data from the data obj if its length exceed the maximum allowed length
        if (serverDataPreped.importantWords.length >= twitterProfileAmount && serverDataPreped.hashtagData.length >= twitterProfileAmount * 6) {
            serverDataPreped.importantWords.shift();
            serverDataPreped.hashtagData.splice(0, 6); // start index 0, delete 6 items (6 is the length of sentiments array)
        };

        // Construct data object
        // Order should be v-n, n, sw-n, sw-p, p, v-p
        hashtagObjArray[0] = { hashtag: data.id, sentiment: 'very-negative', value: data.sentimentsVeryNegative };
        hashtagObjArray[1] = { hashtag: data.id, sentiment: 'negative', value: data.sentimentsNegative };
        hashtagObjArray[2] = { hashtag: data.id, sentiment: 'somewhat-negative', value: data.sentimentsSomewhatNegative };
        hashtagObjArray[3] = { hashtag: data.id, sentiment: 'somewhat-positive', value: data.sentimentsSomewhatPositive };
        hashtagObjArray[4] = { hashtag: data.id, sentiment: 'positive', value: data.sentimentsPositive };
        hashtagObjArray[5] = { hashtag: data.id, sentiment: 'very-positive', value: data.sentimentsVeryPositive };

        // Construct the array for the important terms of the provided data object
        data.importantTerms.forEach(element => {
            importantWordsObj.children.push({ name: element });
        })

        serverDataPreped.importantWords.push(importantWordsObj);
        serverDataPreped.hashtagData = serverDataPreped.hashtagData.concat(hashtagObjArray);

        drawBarChart(serverDataPreped);

        drawTidyTree(serverDataPreped);
    }
};

// Updates the warning (i.e. Wrong search term, duplicate terms, etc)
function appendWarning(warningText) {
    const warningP = document.createElement("p");
    warningP.textContent = warningText;
    warningDiv.appendChild(warningP);
};

document.getElementById('searchForm').addEventListener('submit', twitterData);