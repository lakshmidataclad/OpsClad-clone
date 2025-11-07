// app/api/upload-pto-json/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    // Directory where PTO JSON files are stored (from your Python script)
    const ptoDirectory = path.join(process.cwd(), 'pto_records')
    
    if (!fs.existsSync(ptoDirectory)) {
      return NextResponse.json(
        { error: 'PTO records directory not found' },
        { status: 404 }
      )
    }

    // Read all JSON files in the directory
    const files = fs.readdirSync(ptoDirectory).filter(file => file.endsWith('.json'))
    
    if (files.length === 0) {
      return NextResponse.json(
        { message: 'No PTO JSON files found', count: 0 },
        { status: 200 }
      )
    }

    let totalUploaded = 0
    const errors: string[] = []

    for (const file of files) {
      try {
        const filePath = path.join(ptoDirectory, file)
        const fileContent = fs.readFileSync(filePath, 'utf8')
        const ptoData = JSON.parse(fileContent)

        if (!Array.isArray(ptoData)) {
          errors.push(`${file}: Invalid JSON format - expected array`)
          continue
        }

        // Transform and validate PTO records
        const transformedRecords = ptoData.map(record => ({
          date: record.date,
          day: record.day,
          hours: parseFloat(record.hours) || 0,
          employee_name: record.employee_name || '',
          employee_id: record.employee_id || '',
          sender_email: record.sender_email || '',
        })).filter(record => 
          record.date && 
          record.day && 
          record.hours > 0 && 
          record.employee_name &&
          record.employee_id
        )

        if (transformedRecords.length === 0) {
          errors.push(`${file}: No valid PTO records found`)
          continue
        }

        // Insert records into Supabase with upsert to handle duplicates
        const { data, error } = await supabase
          .from('pto_records')
          .upsert(transformedRecords, {
            onConflict: 'date,employee_id', // Avoid duplicates based on date and employee
            ignoreDuplicates: true
          })
          .select()

        if (error) {
          errors.push(`${file}: Database error - ${error.message}`)
          console.error(`Error inserting PTO records from ${file}:`, error)
          continue
        }

        totalUploaded += data?.length || 0
        
        // Optionally, move processed file to a processed directory or delete it
        // fs.unlinkSync(filePath) // Uncomment to delete processed files
        
      } catch (fileError) {
        errors.push(`${file}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`)
        console.error(`Error processing ${file}:`, fileError)
      }
    }

    return NextResponse.json({
      message: `Successfully processed ${files.length} files`,
      count: totalUploaded,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Error uploading PTO data:', error)
    return NextResponse.json(
      { error: 'Failed to upload PTO data' },
      { status: 500 }
    )
  }
}