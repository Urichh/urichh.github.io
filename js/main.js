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

//get time spent on site
const start = Date.now();
const timePresentField = document.getElementById("timePresentField");
setInterval(() => {
    const seconds = Math.round((Date.now() - start) / 1000);
    timePresentField.textContent = seconds;
}, 1000);

//pattern size slider
const patternSlider = document.getElementById("patternSlider");
const htmlElement = document.documentElement;

//no slider on mobile
if (patternSlider) {
    //reset slider to default on page load
    patternSlider.value = 113;

    patternSlider.addEventListener("input", (e) => {
        const value = e.target.value;
        htmlElement.style.setProperty("--s", value + "px");
    });
}