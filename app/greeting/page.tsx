import Desktop10Light from './components/Desktop10Light';

export default function GreetingPage() {
  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-100'>
      <div className='w-[1440px] h-[1024px] overflow-hidden shadow-2xl'>
        <Desktop10Light />
      </div>
    </div>
  );
}
