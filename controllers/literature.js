const axios = require("axios");
const parser = require("xml2json");
const { XMLParser } = require("fast-xml-parser");
const { stringify } = require("../utils");

function europePmcSearchPOSTQuery(id) {
  const baseUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC${id}/fullTextXML`;
  return { baseUrl };
}

async function handleLiterartureRequest({ id }) {
  const { baseUrl } = europePmcSearchPOSTQuery(id);
  const requestOptions = {
    method: "GET",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
  };

  let json = null;
  let str = "";
  const parser = new XMLParser();
  await axios.get(baseUrl, requestOptions).then(({ data: XMLData }) => {
    // json = parser.toJson(XMLData);
    const jsonData = parser.parse(XMLData);
    const body = jsonData.article.body;
    json = body;

    // const xmlObject = xml.parse(XMLData);

    // Transform the object back to XML string
    // str = xml(xmlObject, { indent: "  " });

    // str = stringify(json, 2);
  });
  return json;
}

module.exports = { handleLiterartureRequest };
