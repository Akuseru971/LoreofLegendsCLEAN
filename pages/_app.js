import Head from 'next/head'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* Police élégante */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Cormorant+Garamond:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
