import Link from 'next/link';

export default function Success() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4 text-center">
      <div className="bg-gray-900 p-10 rounded-lg shadow-lg max-w-lg w-full">
        <h1 className="text-3xl font-bold mb-4">Thank you for your purchase!</h1>
        <p className="mb-6">
          Your custom lore video will be sent to your email shortly. May your legend echo through Runeterra.
        </p>
        <Link href="/" legacyBehavior>
          <a className="bg-blue-600 hover:bg-blue-800 text-white font-bold py-3 px-6 rounded inline-block">
            Back to Home
          </a>
        </Link>
      </div>
    </div>
  );
}
