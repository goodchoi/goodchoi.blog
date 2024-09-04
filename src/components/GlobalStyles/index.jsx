import { createGlobalStyle } from "styled-components"
import reset from "styled-reset"

const GlobalStyles = createGlobalStyle`
  ${reset}
  @font-face {
    font-family: 'Pretendard Variable';
    font-weight: 45 920;
    font-style: normal;
    font-display: swap;
    src: url('fonts/PretendardVariable.woff2') format('woff2-variations')   
  }
  
  body {
    font-family: 'Pretendard Variable', sans-serif;
    background: ${props => props.theme.colors.bodyBackground};
  }
`

export default GlobalStyles
