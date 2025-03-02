#!/usr/bin/env node

/**
 * RAG Drive FTP Hub Performance Audit Tool
 * This script analyzes the codebase for performance optimizations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createSpinner } = require('nanospinner');

// Configuration
const DEFAULT_CONFIG = {
  targetDirs: ['client/src', 'server'],
  excludeDirs: ['node_modules', 'dist', 'build', 'coverage'],
  reportFile: './performance-audit-report.md',
  rules: {
    'largeComponentCheck': { enabled: true, threshold: 300 },
    'recursiveRenderCheck': { enabled: true },
    'memoCheck': { enabled: true },
    'asyncComponentCheck': { enabled: true },
    'dbQueryCheck': { enabled: true },
    'unnecessaryRenderCheck': { enabled: true },
    'bundleSizeCheck': { enabled: true },
    'unusedDependencyCheck': { enabled: true },
    'redundantQueryCheck': { enabled: true },
    'networkWaterfallCheck': { enabled: true }
  }
};

// Check if config file exists, otherwise use default
let config = DEFAULT_CONFIG;
if (fs.existsSync('./performance-audit.config.js')) {
  try {
    config = { ...DEFAULT_CONFIG, ...require('./performance-audit.config.js') };
    console.log('Using custom configuration from performance-audit.config.js');
  } catch (error) {
    console.error('Error loading custom configuration:', error.message);
    console.log('Falling back to default configuration');
  }
}

// Create report header
const getReportHeader = () => `# RAG Drive FTP Hub Performance Audit Report

Generated on: ${new Date().toLocaleString()}

## Summary

This report provides an analysis of potential performance optimizations for the RAG Drive FTP Hub application.

## Table of Contents

1. [Component Size Analysis](#component-size-analysis)
2. [Recursive Rendering Issues](#recursive-rendering-issues)
3. [Missing Memoization](#missing-memoization)
4. [Inefficient Async Patterns](#inefficient-async-patterns)
5. [Database Query Optimizations](#database-query-optimizations)
6. [Unnecessary Re-renders](#unnecessary-re-renders)
7. [Bundle Size Analysis](#bundle-size-analysis)
8. [Unused Dependencies](#unused-dependencies)
9. [Redundant API Queries](#redundant-api-queries)
10. [Network Request Waterfall](#network-request-waterfall)
11. [Recommendations](#recommendations)

`;

// Find all JS/TS files
const findFiles = (dir, extensions = ['.js', '.jsx', '.ts', '.tsx']) => {
  const spinner = createSpinner('Scanning files...').start();
  const results = [];
  
  try {
    const walkDir = (currentPath) => {
      if (config.excludeDirs.some(exclude => currentPath.includes(exclude))) {
        return;
      }
      
      const files = fs.readdirSync(currentPath);
      
      for (const file of files) {
        const filePath = path.join(currentPath, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isFile() && extensions.includes(path.extname(file))) {
          results.push(filePath);
        } else if (stat.isDirectory()) {
          walkDir(filePath);
        }
      }
    };
    
    for (const targetDir of config.targetDirs) {
      if (fs.existsSync(targetDir)) {
        walkDir(targetDir);
      }
    }
    
    spinner.success({ text: `Found ${results.length} files to analyze` });
    return results;
  } catch (error) {
    spinner.error({ text: `Error scanning files: ${error.message}` });
    process.exit(1);
  }
};

// Analyze large components
const analyzeLargeComponents = (files) => {
  const spinner = createSpinner('Analyzing component sizes...').start();
  const results = [];
  
  try {
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').length;
      
      if (lines > config.rules.largeComponentCheck.threshold) {
        results.push({
          file,
          lines,
          recommendation: `Consider breaking down this component into smaller, reusable components.`
        });
      }
    }
    
    spinner.success({ text: `Found ${results.length} large components` });
    return results;
  } catch (error) {
    spinner.error({ text: `Error analyzing component sizes: ${error.message}` });
    return [];
  }
};

// Detect potential recursive rendering issues
const analyzeRecursiveRenderingIssues = (files) => {
  const spinner = createSpinner('Checking for recursive rendering issues...').start();
  const results = [];
  
  try {
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Look for patterns that might cause recursive rendering
      if (
        (content.includes('useState') || content.includes('useReducer')) && 
        content.includes('useEffect') && 
        content.includes('setState') &&
        !content.includes('useCallback')
      ) {
        results.push({
          file,
          issue: 'Potential recursive rendering',
          recommendation: 'Verify that state updates in useEffect are not causing infinite loops. Consider adding dependencies array or using useCallback.'
        });
      }
    }
    
    spinner.success({ text: `Found ${results.length} potential recursive rendering issues` });
    return results;
  } catch (error) {
    spinner.error({ text: `Error analyzing recursive rendering: ${error.message}` });
    return [];
  }
};

// Identify components that could benefit from memoization
const analyzeMissingMemoization = (files) => {
  const spinner = createSpinner('Checking for missing memoization...').start();
  const results = [];
  
  try {
    for (const file of files) {
      if (file.includes('.test.') || file.includes('.spec.')) continue;
      
      const content = fs.readFileSync(file, 'utf8');
      
      // Look for functional components without memo
      if (
        content.includes('function') && 
        content.includes('return (') && 
        content.includes('props') &&
        !content.includes('React.memo') && 
        !content.includes('memo(') && 
        !content.includes('useCallback') &&
        !content.includes('useMemo')
      ) {
        results.push({
          file,
          issue: 'Missing memoization',
          recommendation: 'Consider using React.memo() for this component to prevent unnecessary re-renders.'
        });
      }
      
      // Look for computed values that could be memoized
      if (
        content.includes('const') && 
        content.includes('map(') && 
        content.includes('filter(') && 
        !content.includes('useMemo')
      ) {
        results.push({
          file,
          issue: 'Computed values without memoization',
          recommendation: 'Consider using useMemo() for expensive computations to prevent recalculations on each render.'
        });
      }
    }
    
    spinner.success({ text: `Found ${results.length} components that could benefit from memoization` });
    return results;
  } catch (error) {
    spinner.error({ text: `Error analyzing memoization: ${error.message}` });
    return [];
  }
};

// Analyze inefficient async patterns
const analyzeAsyncPatterns = (files) => {
  const spinner = createSpinner('Checking for inefficient async patterns...').start();
  const results = [];
  
  try {
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for sequential promises that could be parallelized
      if (
        content.includes('await') && 
        content.includes('then(') && 
        !content.includes('Promise.all')
      ) {
        results.push({
          file,
          issue: 'Sequential promises',
          recommendation: 'Consider using Promise.all() to parallelize independent async operations.'
        });
      }
      
      // Check for async operations in loops
      if (
        (content.includes('for (') || content.includes('forEach(') || content.includes('.map(')) && 
        content.includes('await')
      ) {
        results.push({
          file,
          issue: 'Async operations in loops',
          recommendation: 'Consider batching async operations or using Promise.all() with mapped promises.'
        });
      }
    }
    
    spinner.success({ text: `Found ${results.length} inefficient async patterns` });
    return results;
  } catch (error) {
    spinner.error({ text: `Error analyzing async patterns: ${error.message}` });
    return [];
  }
};

// Analyze database queries
const analyzeDatabaseQueries = (files) => {
  const spinner = createSpinner('Analyzing database queries...').start();
  const results = [];
  
  try {
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Look for potentially inefficient queries
      if (
        (content.includes('SELECT *') || content.includes('findAll')) && 
        (content.includes('JOIN') || content.includes('$infer'))
      ) {
        results.push({
          file,
          issue: 'Potentially inefficient query',
          recommendation: 'Consider selecting only necessary columns instead of using SELECT * or findAll().'
        });
      }
      
      // Look for missing indexes
      if (
        (content.includes('WHERE') || content.includes('find(') || content.includes('filter(')) && 
        !content.includes('INDEX') && 
        !content.includes('createIndex')
      ) {
        results.push({
          file,
          issue: 'Potential missing index',
          recommendation: 'Verify that database columns used in WHERE clauses have proper indexes.'
        });
      }
      
      // Look for N+1 query problems
      if (
        content.includes('forEach') && 
        (content.includes('find(') || content.includes('SELECT') || content.includes('db.'))
      ) {
        results.push({
          file,
          issue: 'Potential N+1 query problem',
          recommendation: 'Consider using eager loading or JOIN operations instead of making separate queries in loops.'
        });
      }
    }
    
    spinner.success({ text: `Found ${results.length} database query optimization opportunities` });
    return results;
  } catch (error) {
    spinner.error({ text: `Error analyzing database queries: ${error.message}` });
    return [];
  }
};

// Run the bundle size analysis
const analyzeBundleSize = () => {
  const spinner = createSpinner('Analyzing bundle size...').start();
  
  try {
    // Check if source-map-explorer is installed
    try {
      execSync('npx source-map-explorer --version', { stdio: 'ignore' });
    } catch (error) {
      spinner.warn({ text: 'source-map-explorer not found. Skipping bundle size analysis.' });
      return {
        recommendation: 'Install source-map-explorer and build with source maps to analyze bundle size.',
        details: []
      };
    }
    
    // Check if we have a build directory with maps
    const buildDir = path.resolve('./build');
    if (!fs.existsSync(buildDir)) {
      spinner.warn({ text: 'Build directory not found. Skipping bundle size analysis.' });
      return {
        recommendation: 'Run a production build with source maps enabled to analyze bundle size.',
        details: []
      };
    }
    
    // Look for JS files with maps
    const jsFiles = fs.readdirSync(buildDir)
      .filter(file => file.endsWith('.js') && fs.existsSync(path.join(buildDir, `${file}.map`)));
    
    if (jsFiles.length === 0) {
      spinner.warn({ text: 'No JavaScript files with source maps found. Skipping bundle size analysis.' });
      return {
        recommendation: 'Ensure your build process generates source maps for bundle analysis.',
        details: []
      };
    }
    
    // Run source-map-explorer on each file
    const results = [];
    for (const file of jsFiles) {
      const output = execSync(`npx source-map-explorer ${path.join(buildDir, file)} --json`).toString();
      const parsed = JSON.parse(output);
      
      // Extract the largest chunks
      const bundles = Object.entries(parsed.files || {})
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 5)
        .map(([name, data]) => ({
          name,
          size: (data.size / 1024).toFixed(2) + ' KB',
          percentage: (data.size / parsed.totalBytes * 100).toFixed(2) + '%'
        }));
      
      results.push({
        file,
        totalSize: (parsed.totalBytes / 1024).toFixed(2) + ' KB',
        largestChunks: bundles
      });
    }
    
    spinner.success({ text: `Analyzed bundle size for ${results.length} files` });
    return {
      recommendation: 'Consider code splitting, tree shaking, and lazy loading to reduce bundle sizes.',
      details: results
    };
  } catch (error) {
    spinner.error({ text: `Error analyzing bundle size: ${error.message}` });
    return {
      recommendation: 'Run a production build with source maps for accurate bundle analysis.',
      details: []
    };
  }
};

// Check for unused dependencies
const analyzeUnusedDependencies = () => {
  const spinner = createSpinner('Checking for unused dependencies...').start();
  
  try {
    // Check if depcheck is installed
    try {
      execSync('npx depcheck --version', { stdio: 'ignore' });
    } catch (error) {
      spinner.warn({ text: 'depcheck not found. Skipping unused dependencies check.' });
      return {
        recommendation: 'Install depcheck to find unused dependencies.',
        unused: []
      };
    }
    
    // Run depcheck
    const output = execSync('npx depcheck --json').toString();
    const parsed = JSON.parse(output);
    
    const unused = Object.keys(parsed.dependencies || {});
    
    spinner.success({ text: `Found ${unused.length} unused dependencies` });
    return {
      recommendation: 'Consider removing unused dependencies to reduce bundle size and improve install times.',
      unused
    };
  } catch (error) {
    spinner.error({ text: `Error checking unused dependencies: ${error.message}` });
    return {
      recommendation: 'Run depcheck manually to find unused dependencies.',
      unused: []
    };
  }
};

// Check for redundant API queries
const analyzeRedundantQueries = (files) => {
  const spinner = createSpinner('Analyzing API query patterns...').start();
  const results = [];
  
  try {
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for TanStack Query without proper query keys
      if (
        content.includes('useQuery') && 
        !content.includes('staleTime') && 
        !content.includes('cacheTime')
      ) {
        results.push({
          file,
          issue: 'Missing query cache configuration',
          recommendation: 'Configure staleTime and cacheTime to reduce redundant network requests.'
        });
      }
      
      // Check for raw fetch without caching
      if (
        content.includes('fetch(') && 
        !content.includes('cache:') && 
        !content.includes('useQuery')
      ) {
        results.push({
          file,
          issue: 'Raw fetch without caching',
          recommendation: 'Consider using TanStack Query or implementing a caching strategy for fetch calls.'
        });
      }
      
      // Check for axios without interceptors
      if (
        content.includes('axios') && 
        !content.includes('interceptors')
      ) {
        results.push({
          file,
          issue: 'Axios without interceptors',
          recommendation: 'Consider setting up axios interceptors for centralized request/response handling and caching.'
        });
      }
    }
    
    spinner.success({ text: `Found ${results.length} potential API query optimizations` });
    return results;
  } catch (error) {
    spinner.error({ text: `Error analyzing API queries: ${error.message}` });
    return [];
  }
};

// Generate the final report
const generateReport = (analysis) => {
  const spinner = createSpinner('Generating performance audit report...').start();
  
  try {
    let report = getReportHeader();
    
    // Component Size Analysis
    report += '\n## Component Size Analysis\n\n';
    if (analysis.largeComponents.length > 0) {
      report += 'The following components exceed the recommended size threshold:\n\n';
      report += '| File | Lines | Recommendation |\n';
      report += '|------|-------|---------------|\n';
      for (const component of analysis.largeComponents) {
        report += `| ${component.file} | ${component.lines} | ${component.recommendation} |\n`;
      }
    } else {
      report += 'No excessively large components found. Great job keeping components concise!\n';
    }
    
    // Recursive Rendering Issues
    report += '\n## Recursive Rendering Issues\n\n';
    if (analysis.recursiveRenderingIssues.length > 0) {
      report += 'The following components may have recursive rendering issues:\n\n';
      report += '| File | Issue | Recommendation |\n';
      report += '|------|-------|---------------|\n';
      for (const issue of analysis.recursiveRenderingIssues) {
        report += `| ${issue.file} | ${issue.issue} | ${issue.recommendation} |\n`;
      }
    } else {
      report += 'No potential recursive rendering issues detected.\n';
    }
    
    // Missing Memoization
    report += '\n## Missing Memoization\n\n';
    if (analysis.missingMemoization.length > 0) {
      report += 'The following components could benefit from memoization:\n\n';
      report += '| File | Issue | Recommendation |\n';
      report += '|------|-------|---------------|\n';
      for (const issue of analysis.missingMemoization) {
        report += `| ${issue.file} | ${issue.issue} | ${issue.recommendation} |\n`;
      }
    } else {
      report += 'No components found that require additional memoization.\n';
    }
    
    // Inefficient Async Patterns
    report += '\n## Inefficient Async Patterns\n\n';
    if (analysis.asyncPatterns.length > 0) {
      report += 'The following files contain inefficient async patterns:\n\n';
      report += '| File | Issue | Recommendation |\n';
      report += '|------|-------|---------------|\n';
      for (const issue of analysis.asyncPatterns) {
        report += `| ${issue.file} | ${issue.issue} | ${issue.recommendation} |\n`;
      }
    } else {
      report += 'No inefficient async patterns detected.\n';
    }
    
    // Database Query Optimizations
    report += '\n## Database Query Optimizations\n\n';
    if (analysis.databaseQueries.length > 0) {
      report += 'The following files contain potential database query optimizations:\n\n';
      report += '| File | Issue | Recommendation |\n';
      report += '|------|-------|---------------|\n';
      for (const issue of analysis.databaseQueries) {
        report += `| ${issue.file} | ${issue.issue} | ${issue.recommendation} |\n`;
      }
    } else {
      report += 'No database query optimization opportunities detected.\n';
    }
    
    // Bundle Size Analysis
    report += '\n## Bundle Size Analysis\n\n';
    report += `Recommendation: ${analysis.bundleSize.recommendation}\n\n`;
    if (analysis.bundleSize.details.length > 0) {
      for (const bundle of analysis.bundleSize.details) {
        report += `### ${bundle.file} (${bundle.totalSize})\n\n`;
        report += '| Module | Size | Percentage |\n';
        report += '|--------|------|------------|\n';
        for (const chunk of bundle.largestChunks) {
          report += `| ${chunk.name} | ${chunk.size} | ${chunk.percentage} |\n`;
        }
        report += '\n';
      }
    } else {
      report += 'No bundle size details available.\n';
    }
    
    // Unused Dependencies
    report += '\n## Unused Dependencies\n\n';
    report += `Recommendation: ${analysis.unusedDependencies.recommendation}\n\n`;
    if (analysis.unusedDependencies.unused.length > 0) {
      report += 'The following dependencies appear to be unused:\n\n';
      report += '- ' + analysis.unusedDependencies.unused.join('\n- ') + '\n';
    } else {
      report += 'No unused dependencies detected.\n';
    }
    
    // Redundant API Queries
    report += '\n## Redundant API Queries\n\n';
    if (analysis.redundantQueries.length > 0) {
      report += 'The following files may contain redundant API queries:\n\n';
      report += '| File | Issue | Recommendation |\n';
      report += '|------|-------|---------------|\n';
      for (const issue of analysis.redundantQueries) {
        report += `| ${issue.file} | ${issue.issue} | ${issue.recommendation} |\n`;
      }
    } else {
      report += 'No redundant API query patterns detected.\n';
    }
    
    // Network Request Waterfall
    report += '\n## Network Request Waterfall\n\n';
    report += 'To analyze network request waterfalls:\n\n';
    report += '1. Use the Network tab in your browser\'s Developer Tools\n';
    report += '2. Look for sequential requests that could be parallelized\n';
    report += '3. Identify long-running requests that block rendering\n';
    report += '4. Check for appropriate caching headers\n';
    
    // Overall Recommendations
    report += '\n## Recommendations\n\n';
    const totalIssues = 
      analysis.largeComponents.length +
      analysis.recursiveRenderingIssues.length +
      analysis.missingMemoization.length +
      analysis.asyncPatterns.length +
      analysis.databaseQueries.length +
      analysis.redundantQueries.length +
      analysis.unusedDependencies.unused.length;
    
    if (totalIssues > 0) {
      report += 'Based on the analysis, here are the top recommendations:\n\n';
      
      if (analysis.largeComponents.length > 0) {
        report += '1. **Refactor large components**: Break down components that exceed 300 lines into smaller, more manageable pieces.\n';
      }
      
      if (analysis.missingMemoization.length > 0) {
        report += '2. **Add memoization**: Use React.memo, useMemo, and useCallback to prevent unnecessary renders and computations.\n';
      }
      
      if (analysis.databaseQueries.length > 0) {
        report += '3. **Optimize database queries**: Select only necessary columns, add appropriate indexes, and prevent N+1 query problems.\n';
      }
      
      if (analysis.asyncPatterns.length > 0) {
        report += '4. **Improve async patterns**: Parallelize independent async operations and avoid sequential waterfalls.\n';
      }
      
      if (analysis.redundantQueries.length > 0) {
        report += '5. **Implement proper caching**: Configure TanStack Query properly or implement caching for fetch/axios calls.\n';
      }
      
      if (analysis.unusedDependencies.unused.length > 0) {
        report += '6. **Remove unused dependencies**: Clean up package.json to reduce bundle size and improve install times.\n';
      }
      
      if (analysis.recursiveRenderingIssues.length > 0) {
        report += '7. **Fix potential infinite loops**: Ensure useEffect dependencies are properly configured.\n';
      }
    } else {
      report += 'No significant performance issues were detected. Here are some general recommendations:\n\n';
      report += '1. **Implement code splitting**: Use dynamic imports to load code only when needed\n';
      report += '2. **Add performance monitoring**: Set up tools like Lighthouse CI or Performance Monitoring in production\n';
      report += '3. **Review third-party dependencies**: Regularly audit dependencies for size and performance impact\n';
      report += '4. **Implement proper caching strategies**: Use service workers and CDN caching where appropriate\n';
    }
    
    // Write report to file
    fs.writeFileSync(config.reportFile, report);
    spinner.success({ text: `Performance audit report generated: ${config.reportFile}` });
    
    return totalIssues;
  } catch (error) {
    spinner.error({ text: `Error generating report: ${error.message}` });
    return 0;
  }
};

// Main function
const main = async () => {
  console.log('\n🔍 Starting RAG Drive FTP Hub Performance Audit\n');
  
  // Find all source files
  const files = findFiles('.');
  
  // Run various analyses
  const largeComponents = config.rules.largeComponentCheck.enabled 
    ? analyzeLargeComponents(files) 
    : [];
  
  const recursiveRenderingIssues = config.rules.recursiveRenderCheck.enabled 
    ? analyzeRecursiveRenderingIssues(files) 
    : [];
  
  const missingMemoization = config.rules.memoCheck.enabled 
    ? analyzeMissingMemoization(files) 
    : [];
  
  const asyncPatterns = config.rules.asyncComponentCheck.enabled 
    ? analyzeAsyncPatterns(files) 
    : [];
  
  const databaseQueries = config.rules.dbQueryCheck.enabled 
    ? analyzeDatabaseQueries(files) 
    : [];
  
  const bundleSize = config.rules.bundleSizeCheck.enabled 
    ? analyzeBundleSize() 
    : { recommendation: 'Bundle size analysis skipped.', details: [] };
  
  const unusedDependencies = config.rules.unusedDependencyCheck.enabled 
    ? analyzeUnusedDependencies() 
    : { recommendation: 'Unused dependencies check skipped.', unused: [] };
  
  const redundantQueries = config.rules.redundantQueryCheck.enabled 
    ? analyzeRedundantQueries(files) 
    : [];
  
  // Generate report
  const totalIssues = generateReport({
    largeComponents,
    recursiveRenderingIssues,
    missingMemoization,
    asyncPatterns,
    databaseQueries,
    bundleSize,
    unusedDependencies,
    redundantQueries
  });
  
  // Summary
  console.log('\n📊 Performance Audit Summary:\n');
  console.log(`- ${largeComponents.length} large components`);
  console.log(`- ${recursiveRenderingIssues.length} potential recursive rendering issues`);
  console.log(`- ${missingMemoization.length} components missing memoization`);
  console.log(`- ${asyncPatterns.length} inefficient async patterns`);
  console.log(`- ${databaseQueries.length} database query optimizations`);
  console.log(`- ${unusedDependencies.unused.length} unused dependencies`);
  console.log(`- ${redundantQueries.length} redundant API query patterns`);
  console.log(`\nTotal issues found: ${totalIssues}`);
  console.log(`\nReport saved to: ${config.reportFile}`);
  console.log('\n🚀 Performance audit complete!\n');
};

// Run the main function
main().catch(error => {
  console.error('Error running performance audit:', error);
  process.exit(1);
});