const currency = "USD";
const date_from = "2022-07-07";
const date_to = "2022-07-19";

const url = new URL("https://bank.gov.ua/");

url.pathname = "NBU_Exchange/exchange_site";

url.searchParams.append("valcode", currency);
url.searchParams.append("date_from", date_from);
url.searchParams.append("date_to", date_to);
url.searchParams.append("json", "1");

console.log(url.toString());