import CallList from '@/components/CallList'
import React from 'react'

const Upcoming = () => {
  return (
    <section className='flex size-full flex-col gap-10 text-white'>
    <h1 className='fontWeight-600 fontSize-0.85rem font-bold text-fuchsia-600 filterinvert'>
    Upcoming
    </h1>
    <CallList type='upcoming'/>
      </section>
  )
}

export default Upcoming
