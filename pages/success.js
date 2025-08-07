// pages/success.js
export default function SuccessPage() {
  return (
    <div className="flex items-center justify-center min-h-screen text-white bg-black">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">🎉 Thank you!</h1>
        <p>Your Lore Video will be sent to your email shortly.</p>
        <a href="/" className="text-blue-400 underline">Return to home</a>
      </div>
    </div>
  );
}
