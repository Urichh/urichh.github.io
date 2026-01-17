document.getElementById("year").textContent = new Date().getFullYear();

const age = new Date().getFullYear() - 2004;
document.getElementById("age").textContent = age

const ageField = document.getElementById("age");

ageField.addEventListener("mouseenter", () => {
    ageField.textContent = "Date().getFullYear() - 2004;";
});

ageField.addEventListener("mouseleave", () => {
    ageField.textContent = age;
});