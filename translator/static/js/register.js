// Show / Hide Password

const togglePassword = document.querySelector(".toggle-password");
const password = document.getElementById("password");

togglePassword.addEventListener("click", () => {

    if(password.type === "password"){
        password.type = "text";
        togglePassword.classList.remove("fa-eye");
        togglePassword.classList.add("fa-eye-slash");
    }
    else{
        password.type = "password";
        togglePassword.classList.remove("fa-eye-slash");
        togglePassword.classList.add("fa-eye");
    }

});

// Confirm Password Validation

const form = document.querySelector("form");

form.addEventListener("submit", function(e){

    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm_password").value;

    if(password !== confirm){
        e.preventDefault();
        alert("Passwords do not match!");
    }

});