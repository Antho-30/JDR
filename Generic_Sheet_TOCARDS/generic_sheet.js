var clearStorageButton = undefined;

function initSheet() {
    let inputs = document.querySelectorAll("input,button,textarea");
    for (let input of inputs) {
        if (input.id != undefined && input.id != "clear-storage") {
            input.addEventListener("change", function() {
                onInputChange(input)
            });

            let titleSibling = findFirstSiblingWithClass(input, "field-title");
            if (titleSibling != null) {
                titleSibling.id = `${input.id}-field-title`;
            }
            let descSibling = findFirstSiblingWithClass(input, "field-desc");
            if (descSibling != null) {
                descSibling.id = `${input.id}-field-desc`;
            }

            let finalInput = input; //otherwise the input can change which breaks the onchange handler
            if (titleSibling == null && input.dataset.modifier != undefined) {
                //manual fix for melee/ranged attack buttons being formatted differently
                titleSibling = finalInput;
                finalInput = document.getElementById(finalInput.dataset.modifier);
            }

            if (titleSibling != null && titleSibling.dataset.diceType != undefined) {
                titleSibling.classList.add("interactible-title");
                titleSibling.style.cursor = "pointer";
                titleSibling.addEventListener("click", function() {
                    TS.dice.putDiceInTray([createDiceRoll(titleSibling, finalInput)]);
                    //we are not checking for success or failure here, but could easily by adding a .then (success) and .catch (failure)
                });
                input.setAttribute("aria-labelledby", titleSibling.id);
                if (descSibling != null) {
                    input.setAttribute("aria-describedby", descSibling.id);
                }
            } else if (titleSibling != null) {
                titleSibling.setAttribute("for", input.id);
                if (descSibling != null) {
                    input.setAttribute("aria-describedby", descSibling.id);
                }
            }
        }
    }
}

function onInputChange(input) {
    //handles input changes to store them in local storage
    CALCUL();
    let data;
    // get already stored data
    TS.localStorage.campaign.getBlob().then((storedData) => {
        //parse stored blob as json, but also handle if it's empty by
        //defaulting to an empty json document "{}" if stored data is false
        data = JSON.parse(storedData || "{}");
        if (input.type == "checkbox") {
            data[input.id] = input.checked ? "on" : "off";
        } else {
            data[input.id] = input.value;
        }
        //set new data, handle response
        TS.localStorage.campaign.setBlob(JSON.stringify(data)).then(() => {
            //if storing the data succeeded, enable the clear storage button
            clearStorageButton.classList.add("danger");
            clearStorageButton.disabled = false;
            clearStorageButton.textContent = "Clear Character Sheet";
        }).catch((setBlobResponse) => {
            TS.debug.log("Failed to store change to local storage: " + setBlobResponse.cause);
            console.error("Failed to store change to local storage:", setBlobResponse);
        });
    }).catch((getBlobResponse) => {
        TS.debug.log("Failed to load data from local storage: " + getBlobResponse.cause);
        console.error("Failed to load data from local storage:", getBlobResponse);
    });

    if (input.id == "abilities-text") {
        let actions = parseActions(input.value);
        addActions(actions);
    }
}

function findFirstSiblingWithClass(element, className) {
    let siblings = element.parentElement.children;
    for (let sibling of siblings) {
        if (sibling.classList.contains(className)) {
            return sibling;
        }
    }
    return null;
}

function createDiceRoll(clickElement, inputElement) {
    let modifierString = "";
    if (clickElement.dataset.modifier != "no-mod" && inputElement != null) {
        modifierString = inputElement.value >= 0 ? "+" + inputElement.value : inputElement.value;
    }
    let label = "";
    if (clickElement.dataset.label != undefined) {
        label = clickElement.dataset.label;
    } else {
        label = clickElement.textContent;
    }
    let roll = `${clickElement.dataset.diceType}${modifierString == '+' ? '' : modifierString}`

    //this returns a roll descriptor object. we could be using TS.dice.makeRollDescriptor(`${roll}+${modifierString}`) instead
    //depends mostly on personal preference. using makeRollDescriptor can be safer through updates, but it's also less efficient
    //and would ideally need error handling on the return value (and can be rate limited)
    return { name: label, roll: roll };
}

function parseActions(text) {
    let results = text.matchAll(/(.*) (\d{0,2}d\d{1,2}[+-]?\d*) ?(.*)/gi);
    let actions = [];
    for (let result of results) {
        let action = {
            title: result[1],
            dice: result[2],
            description: result[3]
        }
        actions.push(action);
    }
    return actions;
}

function addActions(results) {
    //remove old actions
    let oldActions = document.querySelectorAll("[id^=list-action]");
    for (let oldAction of oldActions) {
        oldAction.remove();
    }

    //add new actions
    let template = document.getElementById("abilities-template");
    let container = template.parentElement;
    for (let i = 0; i < results.length; i++) {
        let clonedAction = template.content.firstElementChild.cloneNode(true);
        clonedAction.id = "list-action" + i;
        let title = clonedAction.querySelector("[id=abilities-template-title]");
        title.removeAttribute("id");
        title.textContent = results[i]["title"];

        let description = clonedAction.querySelector("[id=abilities-template-desc]");
        description.removeAttribute("id");
        description.textContent = results[i]["description"];

        let button = clonedAction.querySelector("[id=abilities-template-button]");
        button.id = "action-button" + i;
        button.dataset.diceType = results[i]["dice"];
        button.dataset.label = results[i]["title"];
        button.addEventListener("click", function() {
            TS.dice.putDiceInTray([createDiceRoll(button, null)]);
            //we are not checking for success or failure here, but could easily by adding a .then (success) and .catch (failure)
        });

        container.insertBefore(clonedAction, document.getElementById("abilities-text").parentElement);
    }
}

function populateTHAC0(event) {
    let matrix = document.getElementById("thac0-matrix");
    let children = matrix.children;
    let remainingElements = 9;
    for (let child of children) {
        if (child.classList.contains("field-data-short")) {
            child.textContent = event.target.value - remainingElements;
            remainingElements--;
        }
    }
}

function loadStoredData() {
    TS.localStorage.campaign.getBlob().then((storedData) => {
        //localstorage blobs are just unstructured text.
        //this means we can store whatever we like, but we also need to parse it to use it.
        let data = JSON.parse(storedData || "{}");
        if (Object.entries(data).length > 0) {
            clearStorageButton.classList.add("danger");
            clearStorageButton.disabled = false;
            clearStorageButton.textContent = "Clear Character Sheet";
        }
        let keyCount = 0;
        for (let [key, value] of Object.entries(data)) {
            keyCount++;
            let element = document.getElementById(key);
            element.value = value;
            if (key == "thac0") {
                element.dispatchEvent(new Event('change'));
            } else if (element.type == "checkbox") {
                element.checked = value == "on" ? true : false;
            } else if (key == "abilities-text") {
                let results = parseActions(element.value);
                addActions(results);
            }
        }
        //adding some log information to the symbiote log
        //this doesn't have particular importance, but is here to show how it's done
        TS.debug.log(`Loaded ${keyCount} values from storage`);
    });
}

function clearSheet() {
    //clear stored data
    TS.localStorage.campaign.deleteBlob().then(() => {
        //if the delete succeeded (.then), set the UI to reflect that
        clearStorageButton.classList.remove("danger");
        clearStorageButton.disabled = true;
        clearStorageButton.textContent = "Character Sheet Empty";
    }).catch((deleteResponse) => {
        //if the delete failed (.catch), write a message to symbiote log
        TS.debug.log("Failed to delete local storage: " + deleteResponse.cause);
        console.error("Failed to delete local storage:", deleteResponse);
    });

    //clear sheet inputs
    let inputs = document.querySelectorAll("input,textarea");
    for (let input of inputs) {
        switch (input.type) {
            case "button":
                break;
            case "checkbox":
                input.checked = false;
                break;
            default:
                input.value = "";
                break;
        }
    }
}

function onStateChangeEvent(msg) {
    if (msg.kind === "hasInitialized") {
        //the TS Symbiote API has initialized and we can begin the setup. think of this as "init".
        clearStorageButton = document.getElementById("clear-storage");
        loadStoredData();
        initSheet();
    }
}

//Mes fonctions du sang

function CALCULMODIF(TOTCARAC){
    if (Math.floor(parseFloat(TOTCARAC)/10<1)) {
        MODIF = parseFloat(TOTCARAC)-10
      } else {
        MODIF=Math.floor(parseFloat(TOTCARAC)/10)
      }
    return MODIF
}
function CALCULDEPLACEMENT(Encombrement){
    if (Math.floor(parseFloat(Encombrement)<0)) {
        Deplacement = 5
      } else {
        Deplacement = 5-Encombrement
      }
    return Deplacement
}

function CALCULEncombrement(Encombrement){
    if (Math.floor(parseFloat(Encombrement)<0)) {
        MODIFEB=0
      } else {
        MODIFEB=Encombrement
      }
    return MODIFEB
}

function CALCULConnaissance(Connaissance,MODIFConnaissance,BConnaissance){
    if (document.getElementById(Connaissance).checked == true) {
        TOTConnaissance=parseFloat(MODIFConnaissance)+parseFloat(BConnaissance)
      } else {
        TOTConnaissance=""
      }
    return TOTConnaissance
}

function CALCUL(){
    var LFOR = document.getElementById('LFOR').value ;
    var LDEX = document.getElementById('LDEX').value ;
    var LCON = document.getElementById('LCON').value ;
    var LSAG = document.getElementById('LSAG').value ;
    var LINT = document.getElementById('LINT').value ;
    var LCHA = document.getElementById('LCHA').value ;
   
    var BFOR = document.getElementById('BFOR').value ;
    var BDEX = document.getElementById('BDEX').value ;
    var BCON = document.getElementById('BCON').value ;
    var BSAG = document.getElementById('BSAG').value ;
    var BINT = document.getElementById('BINT').value ;
    var BCHA = document.getElementById('BCHA').value ;

    var MFOR = document.getElementById('MFOR').value ;
    var MDEX = document.getElementById('MDEX').value ;
    var MCON = document.getElementById('MCON').value ;
    var MSAG = document.getElementById('MSAG').value ;
    var MINT = document.getElementById('MINT').value ;
    var MCHA = document.getElementById('MCHA').value ;

    document.getElementById('TOTFOR').value =  parseFloat(LFOR)+parseFloat(BFOR)+parseFloat(MFOR);
    document.getElementById('TOTDEX').value =  parseFloat(LDEX)+parseFloat(BDEX)+parseFloat(MDEX);
    document.getElementById('TOTCON').value =  parseFloat(LCON)+parseFloat(BCON)+parseFloat(MCON);
    document.getElementById('TOTSAG').value =  parseFloat(LSAG)+parseFloat(BSAG)+parseFloat(MSAG);
    document.getElementById('TOTINT').value =  parseFloat(LINT)+parseFloat(BINT)+parseFloat(MINT);
    document.getElementById('TOTCHA').value =  parseFloat(LCHA)+parseFloat(BCHA)+parseFloat(MCHA);

    var TOTFOR = document.getElementById('TOTFOR').value ;
    var TOTDEX = document.getElementById('TOTDEX').value ;
    var TOTCON = document.getElementById('TOTCON').value ;
    var TOTSAG = document.getElementById('TOTSAG').value ;
    var TOTINT = document.getElementById('TOTINT').value ;
    var TOTCHA = document.getElementById('TOTCHA').value ;

    document.getElementById('MODIF_FOR').value =  CALCULMODIF(TOTFOR);
    document.getElementById('MODIF_DEX').value =  CALCULMODIF(TOTDEX);
    document.getElementById('MODIF_CON').value =  CALCULMODIF(TOTCON);
    document.getElementById('MODIF_SAG').value =  CALCULMODIF(TOTSAG);
    document.getElementById('MODIF_INT').value =  CALCULMODIF(TOTINT);
    document.getElementById('MODIF_CHA').value =  CALCULMODIF(TOTCHA);
    
    var MODIF_FOR = document.getElementById('MODIF_FOR').value ;
    var MODIF_DEX = document.getElementById('MODIF_DEX').value ;
    var MODIF_CON = document.getElementById('MODIF_CON').value ;
    var MODIF_SAG = document.getElementById('MODIF_SAG').value ;
    var MODIF_INT = document.getElementById('MODIF_INT').value ;
    var MODIF_CHA = document.getElementById('MODIF_CHA').value ;
    
    document.getElementById('PVTOT').value = parseFloat(TOTCON) * 2 ;
    document.getElementById('PMTOT').value = parseFloat(TOTSAG) * 2 ;
    document.getElementById('PVRegen').value = parseFloat(MODIF_CON) ;
    document.getElementById('PMRegen').value = parseFloat(MODIF_SAG) ;
    document.getElementById('Initiative').value = parseFloat(MODIF_INT) ;

    document.getElementById('PrecisionCAC').value = parseFloat(MODIF_DEX) ;
    document.getElementById('PrecisionDIS').value = parseFloat(MODIF_DEX) ;
    document.getElementById('PrecisionMAG').value = parseFloat(MODIF_INT) ;

    document.getElementById('Reflexe').value = parseFloat(MODIF_DEX) ;
    document.getElementById('Vigueur').value = parseFloat(MODIF_CON) ;
    document.getElementById('Volonte').value = parseFloat(MODIF_SAG) ;
    
    var CAPHYCasque = document.getElementById('CAPHYCasque').value ;
    var CAPHYArmure = document.getElementById('CAPHYArmure').value ;
    var CAPHYJambieres = document.getElementById('CAPHYJambieres').value ;
    var CAPHYBouclier = document.getElementById('CAPHYBouclier').value ;
    var CAMAGCasque = document.getElementById('CAMAGCasque').value ;
    var CAMAGArmure = document.getElementById('CAMAGArmure').value ;
    var CAMAGJambieres = document.getElementById('CAMAGJambieres').value ;
    var CAMAGBouclier = document.getElementById('CAMAGBouclier').value ;
    var BlocageBouclier = document.getElementById('BlocageBouclier').value ; 

    document.getElementById('CAPHYTOT').value = parseFloat(CAPHYCasque) + parseFloat(CAPHYArmure) + parseFloat(CAPHYJambieres) + parseFloat(CAPHYBouclier);
    document.getElementById('CAMAGTOT').value = parseFloat(CAMAGCasque) + parseFloat(CAMAGArmure) + parseFloat(CAMAGJambieres) + parseFloat(CAMAGBouclier);

    var CAPHYTOT = document.getElementById('CAPHYTOT').value ;
    document.getElementById('Encombrement').value = -2*parseFloat(MODIF_FOR)+parseFloat(CAPHYTOT) ;

    var Encombrement = document.getElementById('Encombrement').value ;
    document.getElementById('Deplacement').value = CALCULDEPLACEMENT(Encombrement) + Math.floor(parseFloat(MODIF_DEX)/2);

    document.getElementById('ESQUIVE').value = parseFloat(MODIF_DEX)-CALCULEncombrement(Encombrement);
    document.getElementById('BLOCAGE').value = parseFloat(MODIF_FOR)-CALCULEncombrement(Encombrement) + parseFloat(BlocageBouclier);


    document.getElementById('TOTAcrobaties').value = CALCULConnaissance("Acrobaties",MODIF_DEX,document.getElementById('BAcrobaties').value);
    document.getElementById('TOTArtdelamagie').value = CALCULConnaissance("Artdelamagie",MODIF_INT,document.getElementById('BArtdelamagie').value );
    document.getElementById('TOTArtisanat(Alchimie)').value = CALCULConnaissance("Artisanat(Alchimie)",MODIF_INT,document.getElementById('BArtisanat(Alchimie)').value );
    document.getElementById('TOTBluff').value = CALCULConnaissance("Bluff",MODIF_CHA,document.getElementById('BBluff').value );
    document.getElementById('TOTConcentration').value = CALCULConnaissance("Concentration",MODIF_CON,document.getElementById('BConcentration').value );
    document.getElementById('TOTConnaissances(architecture)').value = CALCULConnaissance("Connaissances(architecture)",MODIF_INT,document.getElementById('BConnaissances(architecture)').value );
    document.getElementById('TOTConnaissances(Mysteres)').value = CALCULConnaissance("Connaissances(Mysteres)",MODIF_INT,document.getElementById('BConnaissances(Mysteres)').value );
    document.getElementById('TOTConnaissance(Histoire)').value = CALCULConnaissance("Connaissance(Histoire)",MODIF_INT,document.getElementById('BConnaissance(Histoire)').value );
    document.getElementById('TOTConnaissance(Nature)').value = CALCULConnaissance("Connaissance(Nature)",MODIF_INT,document.getElementById('BConnaissance(Nature)').value );
    document.getElementById('TOTConnaissance(Cultures)').value = CALCULConnaissance("Connaissance(Cultures)",MODIF_INT,document.getElementById('BConnaissance(Cultures)').value );
    document.getElementById('TOTConnaissance(Noblesse)').value = CALCULConnaissance("Connaissance(Noblesse)",MODIF_INT,document.getElementById('BConnaissance(Noblesse)').value );
    document.getElementById('TOTConnaissance(Religion)').value = CALCULConnaissance("Connaissance(Religion)",MODIF_INT,document.getElementById('BConnaissance(Religion)').value );
    document.getElementById('TOTContrefacon').value = CALCULConnaissance("Contrefacon",MODIF_INT,document.getElementById('BContrefacon').value );
    document.getElementById('TOTCrochetage').value = CALCULConnaissance("Crochetage",MODIF_DEX,document.getElementById('BCrochetage').value );
    document.getElementById('TOTDecryptage').value = CALCULConnaissance("Decryptage",MODIF_INT,document.getElementById('BDecryptage').value );
    document.getElementById('TOTDeguisement').value = CALCULConnaissance("Deguisement",MODIF_CHA,document.getElementById('BDeguisement').value );
    document.getElementById('TOTDeplacementsilencieux').value = CALCULConnaissance("Deplacementsilencieux",MODIF_DEX,document.getElementById('BDeplacementsilencieux').value );
    document.getElementById('TOTDesamorcage').value = CALCULConnaissance("Desamorcage",MODIF_INT,document.getElementById('BDesamorcage').value );
    document.getElementById('TOTDetection').value = CALCULConnaissance("Detection",MODIF_SAG,document.getElementById('BDetection').value );
    document.getElementById('TOTDiplomatie').value = CALCULConnaissance("Diplomatie",MODIF_CHA,document.getElementById('BDiplomatie').value );
    document.getElementById('TOTDiscretion').value = CALCULConnaissance("Discretion",MODIF_DEX,document.getElementById('BDiscretion').value );
    document.getElementById('TOTDressage').value = CALCULConnaissance("Dressage",MODIF_CHA,document.getElementById('BDressage').value );
    document.getElementById('TOTEmpathieanimaux').value = CALCULConnaissance("Empathieanimaux",MODIF_CHA,document.getElementById('BEmpathieanimaux').value );
    document.getElementById('TOTEquilibre').value = CALCULConnaissance("Equilibre",MODIF_DEX,document.getElementById('BEquilibre').value );
    document.getElementById('TOTEquitation').value = CALCULConnaissance("Equitation",MODIF_DEX,document.getElementById('BEquitation').value );
    document.getElementById('TOTEscalade').value = CALCULConnaissance("Escalade",MODIF_FOR,document.getElementById('BEscalade').value );
    document.getElementById('TOTEstimation').value = CALCULConnaissance("Estimation",MODIF_INT,document.getElementById('BEstimation').value );
    document.getElementById('TOTEvasion').value = CALCULConnaissance("Evasion",MODIF_DEX,document.getElementById('BEvasion').value );
    document.getElementById('TOTFouille').value = CALCULConnaissance("Fouille",MODIF_INT,document.getElementById('BFouille').value );
    document.getElementById('TOTIntimidation').value = CALCULConnaissance("Intimidation",MODIF_CHA,document.getElementById('BIntimidation').value );
    document.getElementById('TOTLangagesecret').value = CALCULConnaissance("Langagesecret",MODIF_SAG,document.getElementById('BLangagesecret').value );
    document.getElementById('TOTLecturesurleslevres').value = CALCULConnaissance("Lecturesurleslevres",MODIF_INT,document.getElementById('BLecturesurleslevres').value );
    document.getElementById('TOTMaitrisedescordes').value = CALCULConnaissance("Maitrisedescordes",MODIF_DEX,document.getElementById('BMaitrisedescordes').value );
    document.getElementById('TOTNatation').value = CALCULConnaissance("Natation",MODIF_FOR,document.getElementById('BNatation').value );
    document.getElementById('TOTPerceptionauditive').value = CALCULConnaissance("Perceptionauditive",MODIF_SAG,document.getElementById('BPerceptionauditive').value );
    document.getElementById('TOTPremierssecours').value = CALCULConnaissance("Premierssecours",MODIF_SAG,document.getElementById('BPremierssecours').value );
    document.getElementById('TOTPsychologie').value = CALCULConnaissance("Psychologie",MODIF_SAG,document.getElementById('BPsychologie').value );
    document.getElementById('TOTRenseignement').value = CALCULConnaissance("Renseignement",MODIF_CHA,document.getElementById('BRenseignement').value );
    document.getElementById('TOTSaut').value = CALCULConnaissance("Saut",MODIF_FOR,document.getElementById('BSaut').value );
    document.getElementById('TOTSensdelorientation').value = CALCULConnaissance("Sensdelorientation",MODIF_SAG,document.getElementById('BSensdelorientation').value );
    document.getElementById('TOTSurvie').value = CALCULConnaissance("Survie",MODIF_SAG,document.getElementById('BSurvie').value );
    document.getElementById('TOTUtilisationobjetsmagiques').value = CALCULConnaissance("Utilisationobjetsmagiques",MODIF_INT,document.getElementById('BUtilisationobjetsmagiques').value );
    document.getElementById('TOTVolalatire').value = CALCULConnaissance("Volalatire",MODIF_DEX,document.getElementById('BVolalatire').value );
}
