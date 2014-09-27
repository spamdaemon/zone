# this file is of no use to anyone by me
#
def PROJECT 
  'zone'
end

def COMPILER_JAR
 '../closure/compiler.jar'
end

rule :sources do
  shell 'find src -name \*.js'
end

rule "#{PROJECT()}.js" => dependency_of(:sources)  do |p,n|
  echo "Cat'ing #{n.flatten.join(' ')} into #{p.file}"
  shell "cat #{n.flatten.join(' ')} > #{p}"
  p.file
end

rule '%.min.js' => [ "{1}.js",'brickfile.rb']  do | p,n|
    echo "Compiling #{n[0]} --> #{p}"
    shell "java -jar #{COMPILER_JAR()} --compilation_level ADVANCED_OPTIMIZATIONS --js_output_file #{p} #{n[0]}"
    p.file
end

rule '%.min.js.gz' => "{1}.min.js" do | p,n|
    rm p.file
    echo "Compressing #{p.file}"
    shell "gzip --best --keep #{n.flatten.join(' ')}"
    p
end

rule :test => [ 'zone.min.js.gz', 'karma.conf.js' ] do
  shell "karma start --single-run --log-level debug"
  true
end

rule :clean do 
  rm %w[zone.js zone.min.js.gz zone.min.js]
end

rule :all => [ :test, 'zone.min.js.gz'] do
  
end
