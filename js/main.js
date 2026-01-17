//get current year for footer
document.getElementById("year").textContent = new Date().getFullYear();

//get my age and display it
let age = new Date().getFullYear() - 2004;
document.getElementById("age").textContent = age
const ageField = document.getElementById("age");
ageField.addEventListener("mouseenter", () => {
    ageField.textContent = "Date().getFullYear() - 2004;";
});
ageField.addEventListener("mouseleave", () => {
    ageField.textContent = age;
});

//track visits (localstorage)
let visits = localStorage.getItem("visitCount");
if (visits === null) {
    visits = 1;
}
else {
    visits = parseInt(visits, 10) + 1;
}
localStorage.setItem("visitCount", visits);

//display visit number
document.getElementById("visitCounterField").textContent = visits;