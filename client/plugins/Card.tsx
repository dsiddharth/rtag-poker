// @ts-ignore
import Card from "@heruka-urgyen/react-playing-cards/lib/index.js";
// @ts-ignore
import reactToWebComponent from "react-to-webcomponent";
import React from "react"
import ReactDOM from "react-dom";

class CardComponent extends React.Component {
    render() {
        return "hello"
    }
}

export default reactToWebComponent(CardComponent, React, ReactDOM);
