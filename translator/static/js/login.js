// ===============================
// Password Show / Hide
// ===============================

const password = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

togglePassword.addEventListener("click", () => {

    const type = password.getAttribute("type") === "password"
        ? "text"
        : "password";

    password.setAttribute("type", type);

    togglePassword.innerHTML =
        type === "password"
        ? '<i class="fa-solid fa-eye"></i>'
        : '<i class="fa-solid fa-eye-slash"></i>';

});


// ===============================
// Form Validation
// ===============================

const form = document.getElementById("loginForm");

form.addEventListener("submit", function (e) {

    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const pass = password.value.trim();

    if (email === "" || pass === "") {

        alert("Please fill all fields.");

        return;

    }

    if (!validateEmail(email)) {

        alert("Enter a valid email address.");

        return;

    }

    if (pass.length < 6) {

        alert("Password must contain at least 6 characters.");

        return;

    }

    const button = document.querySelector(".login-btn");

    button.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Logging In...';

    button.disabled = true;

    setTimeout(() => {

        form.submit();

    }, 1500);

});


// ===============================
// Email Validation
// ===============================

function validateEmail(email){

    const pattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return pattern.test(email);

}


// ===============================
// Enter Key Support
// ===============================

document.addEventListener("keydown",function(e){

    if(e.key==="Enter"){

        form.requestSubmit();

    }

});


// ===============================
// Input Focus Effect
// ===============================

const inputs=document.querySelectorAll("input");

inputs.forEach((input)=>{

    input.addEventListener("focus",()=>{

        input.parentElement.style.boxShadow=
        "0 0 8px rgba(37,99,235,.3)";

    });

    input.addEventListener("blur",()=>{

        input.parentElement.style.boxShadow="none";

    });

});


// ===============================
// Welcome Message
// ===============================

window.addEventListener("load",()=>{

    console.log("Speech to Sign Converter Login Loaded Successfully.");

});