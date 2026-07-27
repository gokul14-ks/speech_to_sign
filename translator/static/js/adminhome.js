// ==========================
// Speech2Sign Admin Dashboard
// ==========================

// Welcome Message

window.addEventListener("load", () => {

    console.log("Speech2Sign Admin Dashboard Loaded.");

});

// Card Hover Animation

const cards = document.querySelectorAll(".card");

cards.forEach(card => {

    card.addEventListener("mouseenter", () => {

        card.style.transform = "translateY(-8px)";

    });

    card.addEventListener("mouseleave", () => {

        card.style.transform = "translateY(0px)";

    });

});

// Delete Confirmation

const deleteLinks = document.querySelectorAll("a[href*='delete']");

deleteLinks.forEach(link => {

    link.addEventListener("click", function(e){

        const confirmDelete = confirm("Are you sure you want to delete this video?");

        if(!confirmDelete){

            e.preventDefault();

        }

    });

});

// Preview Selected Video Before Upload

const fileInput = document.querySelector("input[type='file']");

if(fileInput){

    fileInput.addEventListener("change", function(){

        if(this.files.length > 0){

            alert("Selected Video : " + this.files[0].name);

        }

    });

}