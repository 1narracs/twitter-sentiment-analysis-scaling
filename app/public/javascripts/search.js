// Get twitter information when searched

const twitterProfileAmount = 5;

let count = 0;


const twitterData = (event) => {
    event.preventDefault();
    const searchedTerm = document.getElementById('searchText').value
    document.getElementById('searchText').value = '';
    //console.log(searchEvent.target.textContent);

    // Some sorta regex thingy here needed? 1 space can't get by, but 2 spaces can
    // Maybe replace everything but spaces and a-zA-Z, then split on ' ' for multiple queries?
    if (searchedTerm == 'bad' || searchedTerm == ' '){
        //
    }
    else{
        fetch(`/data/twitter/${searchedTerm}`)
        .then( (response) => {
            return response.json();
        })
        .then ((data) => {
            console.log(data);
            if (data.source == "No Source"){
                //
            }
            else{
                const chosenDiv = (document.getElementsByClassName('stream')).item(count % twitterProfileAmount);
                while(chosenDiv.firstChild){
                    chosenDiv.removeChild(chosenDiv.firstChild)
                }
                const heading = document.createElement("h3");
                heading.textContent =  data.tagName;
                chosenDiv.appendChild(heading);
                const sentiment = document.createElement("p");
                sentiment.textContent =  'Overall sentiment: ' + data.overallSentiment;
                chosenDiv.appendChild(sentiment);
                const importantTerms = document.createElement("p");
                importantTerms.textContent =  'Important terms: ' + data.importantTerms;
                chosenDiv.appendChild(importantTerms);
                count++;
                //return profileData;
            }
        })
        .catch((error) =>{
            console.log(error);
        })
    }
}

document.getElementById('searchForm').addEventListener('submit', twitterData);