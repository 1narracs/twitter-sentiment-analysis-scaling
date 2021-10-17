// Get twitter information when searched
const twitterProfileAmount = 5;
let count = 0;

const twitterData = (event) => {
    event.preventDefault();
    let searchedTerm = document.getElementById('searchText').value
    document.getElementById('searchText').value = '';
    //console.log(searchEvent.target.textContent);

    searchedTerm = searchedTerm.replace(/[^a-zA-Z]+/g, ' ');
    searchedTerm = searchedTerm.trim();

    const warningDiv = document.getElementById('warning');
    while(warningDiv.firstChild){
        warningDiv.removeChild(warningDiv.firstChild)
    }
    if (searchedTerm == ''){
        const warningText = document.createElement("p");
        warningText.textContent =  "Bad search, please only use letters.";
        warningDiv.appendChild(warningText);
    }
    else{
        const searchedTerms = searchedTerm.split(' ');
        searchedTerms.forEach(element => {
            fetch(`/data/twitter/${element.toLowerCase()}`)
            .then( (response) => {
                return response.json();
            })
            .then ((data) => {
                console.log(data);
                const chosenDiv = (document.getElementsByClassName('stream')).item(count % twitterProfileAmount);
                count++;
                while(chosenDiv.firstChild){
                    chosenDiv.removeChild(chosenDiv.firstChild)
                }
                const heading = document.createElement("h3");
                heading.textContent =  element;
                chosenDiv.appendChild(heading);
                if (data.source == "No Source"){
                    const noData = document.createElement("p");
                    noData.textContent =  'No data was able to be retrived';
                    chosenDiv.appendChild(noData);
                }
                else{
                    const sentiment = document.createElement("p");
                    sentiment.textContent =  'Overall sentiment: ' + data.overallSentiment;
                    chosenDiv.appendChild(sentiment);
                    const importantTerms = document.createElement("p");
                    importantTerms.textContent =  'Important terms: ' + data.importantTerms;
                    chosenDiv.appendChild(importantTerms);
                }
            })
            .catch((error) =>{
                console.log(error);
            })
        });
    }
}

document.getElementById('searchForm').addEventListener('submit', twitterData);