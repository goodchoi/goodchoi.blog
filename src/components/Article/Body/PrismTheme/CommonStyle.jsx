import { css } from "styled-components"

const CommonStyle = css`
  code[class*="language-"],
  pre[class*="language-"] {
    margin-bottom: 24px;
    font-size: 16.5px !important;
    border-radius: 7px;
    color: #ccc;
    background: none;
    font-family: "Inconsolata",Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace;
    text-align: left;
    white-space: pre;
    word-spacing: normal;
    word-break: normal;
    word-wrap: normal;
    line-height: 1.4;

    -moz-tab-size: 4;
    -o-tab-size: 4;
    tab-size: 4;

    -webkit-hyphens: none;
    -moz-hyphens: none;
    -ms-hyphens: none;
    hyphens: none;
  }

  /* Code blocks */
  pre[class*="language-"] {
    padding: 1.0em;
    overflow: auto;
    font-size: 14.6px !important;
  }

  /* Inline code */
  :not(pre) > code[class*="language-"] {
    padding: 0.1em;
    border-radius: 0.3em;
    white-space: normal;
    font-size: 15.0px !important;
  }

  .token.important,
  .token.bold {
    font-weight: bold;
  }
  .token.italic {
    font-style: italic;
  }

  .token.entity {
    cursor: help;
  }
`

export default CommonStyle
