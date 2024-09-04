/**
 * Implement Gatsby's SSR (Server Side Rendering) APIs in this file.
 *
 * See: https://www.gatsbyjs.com/docs/ssr-apis/
 */

// You can delete this file if you're not using it

import * as React from "react"

export const onRenderBody = ({ setHeadComponents }) => {
    setHeadComponents([
        // <link rel="stylesheet" as="style" crossOrigin
        //       href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"/>,
        <link rel="preload" href="fonts/PretendardVariable.woff2" as="font" type="font/woff2" crossOrigin/>,
    ])
}
