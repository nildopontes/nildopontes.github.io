window.addEventListener('load', () => {
   document.body.style.minHeight = `${window.innerHeight}px`;
   document.getElementById('year').innerText = new Date().getFullYear();
});
function detail(detail, src){
   if(confirm(detail)) window.location.href = src;
}
