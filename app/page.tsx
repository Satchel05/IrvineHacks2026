'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function Home() {
  const [connectionString, setConnectionString] = useState('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult('');

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionString,
          message: query,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className='min-h-screen p-8 flex items-center justify-center'>
      <Card className='w-full max-w-2xl'>
        <CardHeader>
          <CardTitle>Database Query</CardTitle>
          <CardDescription>
            Connect to your PostgreSQL database and query it using natural
            language
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className='space-y-6'>
            <div className='space-y-2'>
              <Label htmlFor='connectionString'>
                Database Connection String
              </Label>
              <Input
                id='connectionString'
                type='password'
                placeholder='postgresql://user:password@host:port/database'
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='query'>Query</Label>
              <Textarea
                id='query'
                placeholder='Ask a question about your database in natural language...'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={4}
                required
              />
            </div>

            <Button
              type='submit'
              disabled={loading}
              className='w-full'>
              {loading ? 'Querying...' : 'Submit Query'}
            </Button>
          </form>

          {error && (
            <div className='mt-6 p-4 bg-red-50 border border-red-200 rounded-md'>
              <p className='text-red-600'>{error}</p>
            </div>
          )}

          {result && (
            <div className='mt-6 space-y-2'>
              <Label>Result</Label>
              <div className='p-4 bg-muted rounded-md'>
                <pre className='whitespace-pre-wrap text-sm'>{result}</pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
